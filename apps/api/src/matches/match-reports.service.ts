import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchReport, ReportVerdict, ReportStatus } from '../entities/match-report.entity';
import { MatchReportAppeal, AppealStatus } from '../entities/match-report-appeal.entity';
import { Match, MatchStatus } from '../entities/match.entity';
import { User } from '../entities/user.entity';
import { Notification, NotificationType } from '../entities/notification.entity';
import { DeepseekService } from '../deepseek/deepseek.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { UserAction } from '../entities/user-activity-log.entity';
import { AiFeature } from '../entities/ai-usage-log.entity';
import { ReportMatchDto, AppealReportDto } from './dto/report-match.dto';

const MAX_REPORTS_PER_DAY = 3;
const MAX_MATCH_AGE_HOURS = 72;
const APPEAL_WINDOW_HOURS = 48;

const SYSTEM_PROMPT = `Você é um sistema anti-cheat especializado em xadrez online.
Analise os dados da partida e determine se o jogador reportado utilizou engine (programa de xadrez) durante a partida.
Responda APENAS com um JSON válido no formato especificado.
Seja criterioso: falsos positivos prejudicam jogadores legítimos.
Fatores de suspeita: centipawn loss médio muito baixo (< 15), alta taxa de lances perfeitos (> 85%), tempos de resposta uniformemente curtos mesmo em posições complexas, sequências impossíveis para o rating do jogador.`;

interface AiAnalysisResult {
  verdict: 'CLEAN' | 'SUSPICIOUS' | 'CHEATING';
  confidence: number;
  flags: string[];
  explanation_pt: string;
  recommendation: 'APPROVE' | 'MANUAL_REVIEW' | 'BLOCK';
}

@Injectable()
export class MatchReportsService {
  private readonly logger = new Logger(MatchReportsService.name);

  constructor(
    @InjectRepository(MatchReport) private reports: Repository<MatchReport>,
    @InjectRepository(MatchReportAppeal) private appeals: Repository<MatchReportAppeal>,
    @InjectRepository(Match) private matches: Repository<Match>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Notification) private notifications: Repository<Notification>,
    private deepseek: DeepseekService,
    private activity: UserActivityService,
  ) {}

  async createReport(reporterId: string, matchId: string, dto: ReportMatchDto) {
    const match = await this.matches.findOne({
      where: { id: matchId },
      relations: ['whitePlayer', 'blackPlayer'],
    });
    if (!match) throw new NotFoundException('Partida não encontrada');
    if (match.status !== MatchStatus.FINISHED) {
      throw new BadRequestException('Só é possível denunciar partidas finalizadas');
    }
    if (match.isOffline) {
      throw new BadRequestException('Partidas offline não podem ser denunciadas');
    }

    const isParticipant = match.whitePlayerId === reporterId || match.blackPlayerId === reporterId;
    if (!isParticipant) throw new ForbiddenException('Você não participou desta partida');

    const ageHours = (Date.now() - match.finishedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours > MAX_MATCH_AGE_HOURS) {
      throw new BadRequestException(`Denúncias só são aceitas até ${MAX_MATCH_AGE_HOURS}h após a partida`);
    }

    const existing = await this.reports.findOne({ where: { matchId, reporterId } });
    if (existing) throw new ConflictException('Você já denunciou esta partida');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await this.reports.count({
      where: { reporterId },
    });
    // Simple daily cap check using created_at
    const todayReports = await this.reports
      .createQueryBuilder('r')
      .where('r.reporter_id = :rid', { rid: reporterId })
      .andWhere('r.created_at >= :start', { start: todayStart })
      .getCount();
    if (todayReports >= MAX_REPORTS_PER_DAY) {
      throw new BadRequestException(`Limite de ${MAX_REPORTS_PER_DAY} denúncias por dia atingido`);
    }

    const reportedUserId =
      match.whitePlayerId === reporterId ? match.blackPlayerId : match.whitePlayerId;

    const report = await this.reports.save(
      this.reports.create({
        matchId,
        reporterId,
        reportedUserId,
        reporterNote: dto.note ?? null,
        status: ReportStatus.ANALYZING,
      }),
    );

    this.activity.log(reporterId, UserAction.MATCH_REPORTED, { matchId, reportId: report.id });

    this.runAnalysis(report.id, match, reportedUserId).catch((err) =>
      this.logger.error(`Analysis failed for report ${report.id}: ${err}`),
    );

    return { reportId: report.id, status: 'ANALYZING' };
  }

  async getReport(userId: string, matchId: string) {
    const report = await this.reports.findOne({ where: { matchId, reporterId: userId } });
    if (!report) throw new NotFoundException('Denúncia não encontrada');
    return report;
  }

  async createAppeal(userId: string, matchId: string, dto: AppealReportDto) {
    const report = await this.reports.findOne({ where: { matchId, reporterId: userId } });
    if (!report) throw new NotFoundException('Denúncia não encontrada');
    if (report.aiVerdict !== ReportVerdict.CLEAN) {
      throw new BadRequestException('Apelações só são possíveis para veredictos CLEAN');
    }

    const ageHours = (Date.now() - report.updatedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours > APPEAL_WINDOW_HOURS) {
      throw new BadRequestException(`Prazo de apelação de ${APPEAL_WINDOW_HOURS}h expirado`);
    }

    const existingAppeal = await this.appeals.findOne({ where: { reportId: report.id } });
    if (existingAppeal) throw new ConflictException('Você já apelou desta denúncia');

    const appeal = await this.appeals.save(
      this.appeals.create({
        reportId: report.id,
        userId,
        note: dto.note,
        status: AppealStatus.PENDING,
      }),
    );

    await this.reports.update(report.id, { status: ReportStatus.UNDER_REVIEW });
    this.activity.log(userId, UserAction.MATCH_REPORT_APPEALED, { reportId: report.id });

    return appeal;
  }

  // ─── Private: async analysis ────────────────────────────────────────────────

  private async runAnalysis(reportId: string, match: Match, reportedUserId: string) {
    const reportedUser = await this.users.findOne({ where: { id: reportedUserId } });
    if (!reportedUser) return;

    const report = await this.reports.findOne({ where: { id: reportId } });

    const moves: any[] = match.moves ?? [];
    const moveTimes: number[] = moves
      .map((m) => m?.elapsed_ms)
      .filter((t) => typeof t === 'number');

    const avgMoveTimeMs =
      moveTimes.length > 0
        ? moveTimes.reduce((a, b) => a + b, 0) / moveTimes.length
        : null;

    const suspiciouslyFastMoves = moveTimes.filter((t) => t < 1500).length;
    const fastMovePct =
      moveTimes.length > 0 ? suspiciouslyFastMoves / moveTimes.length : null;

    const reportedColor = match.whitePlayerId === reportedUserId ? 'white' : 'black';

    const userPrompt = JSON.stringify({
      match: {
        pgn: match.pgn?.slice(0, 3000) ?? '',
        move_count: moves.length,
        result: match.result,
        reported_player_color: reportedColor,
      },
      reported_player: {
        elo: reportedUser.rating,
        color: reportedColor,
      },
      move_timing: {
        total_moves: moveTimes.length,
        avg_move_time_ms: avgMoveTimeMs ? Math.round(avgMoveTimeMs) : null,
        fast_moves_pct: fastMovePct ? parseFloat(fastMovePct.toFixed(3)) : null,
        min_move_time_ms: moveTimes.length > 0 ? Math.min(...moveTimes) : null,
      },
      reporter_note: report.reporterNote ?? '',
    });

    const result = await this.deepseek.analyze<AiAnalysisResult>(
      AiFeature.MATCH_REPORT,
      SYSTEM_PROMPT,
      userPrompt,
      reportId,
      600,
    );

    if (!result) {
      // DeepSeek unavailable — mark for manual review
      await this.reports.update(reportId, {
        status: ReportStatus.UNDER_REVIEW,
        aiExplanation: 'Análise automática indisponível — encaminhado para revisão manual.',
      });
      return;
    }

    const verdict = result.verdict as ReportVerdict;
    const needsReview =
      verdict === ReportVerdict.CHEATING ||
      (verdict === ReportVerdict.SUSPICIOUS && result.confidence >= 0.8);

    await this.reports.update(reportId, {
      aiVerdict: verdict,
      aiConfidence: result.confidence.toFixed(3),
      aiFlags: result.flags,
      aiExplanation: result.explanation_pt,
      aiRawResponse: result as unknown as object,
      status: needsReview ? ReportStatus.UNDER_REVIEW : ReportStatus.COMPLETED,
    });

    await this.notifyReporter(report.reporterId, match.id, verdict, result.explanation_pt);
  }

  private async notifyReporter(
    userId: string,
    matchId: string,
    verdict: ReportVerdict,
    explanation: string,
  ) {
    await this.notifications.save(
      this.notifications.create({
        userId,
        type: NotificationType.MATCH_REPORT_RESULT,
        payload: { matchId, verdict, explanation },
      }),
    );
  }
}
