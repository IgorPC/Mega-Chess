import { Injectable } from '@nestjs/common';
import { AiFeature } from '../../entities/ai-usage-log.entity';
import { AdminAuditService } from '../admin-audit.service';
import { DeepseekService } from '../../deepseek/deepseek.service';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminReportsRepository } from './admin-reports.repository';
import {
  ADMIN_REPORTS_AI_ANALYSIS_SLA_SECONDS,
  ADMIN_REPORTS_AI_ESCALATION_CONFIDENCE,
  ADMIN_REPORTS_AI_PGN_MAX_CHARS,
  ADMIN_REPORTS_FAST_MOVE_THRESHOLD_MS,
  ADMIN_REPORTS_MAX_LIMIT,
} from './consts/endpoints';

@Injectable()
export class AdminReportsService {
  constructor(
    private readonly repo: AdminReportsRepository,
    private audit: AdminAuditService,
    private deepseek: DeepseekService,
  ) {}

  async list(params: {
    page?: number;
    limit?: number;
    status?: string;
    verdict?: string;
    reportedId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 25, ADMIN_REPORTS_MAX_LIMIT);

    const { data, total } = await this.repo.findPage({ ...params, page, limit });
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getOne(id: string) {
    const report = await this.repo.findById(id);
    if (!report) return null;

    const reportHistory = await this.repo.findRecentByReportedUser(report.reportedUserId);
    const reportHistoryCount = await this.repo.countByReportedUser(report.reportedUserId);
    const tickets = await this.repo.findRecentTicketsByUser(report.reportedUserId);

    return { ...report, reportHistory, reportHistoryCount, tickets };
  }

  async resolve(
    id: string,
    dto: { resolution: string; adminNote?: string },
    admin: Pick<AdminUser, 'id' | 'name'>,
  ) {
    const report = await this.repo.findById(id);
    if (!report) throw new Error('Report not found');

    await this.repo.updateReport(id, {
      status: 'RESOLVED' as any,
      resolution: dto.resolution as any,
      adminNote: dto.adminNote,
      resolvedBy: admin.id,
      resolvedAt: new Date(),
    });

    this.audit.log(admin, 'REPORT_RESOLVED', {
      targetType: 'MatchReport',
      targetId: id,
      details: JSON.stringify(dto),
    });
  }

  async analyzeWithAi(id: string) {
    const report = await this.repo.findByIdWithMatch(id);
    if (!report || !report.match) return null;
    if (report.aiVerdict) return report;

    const match = report.match;
    const moves = (match.moves as any[]) ?? [];
    const timings = moves.map((m) => m.elapsed_ms ?? 0).filter((t) => t > 0);
    const avgMs = timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : 0;
    const fastPct = timings.length
      ? timings.filter((t) => t < ADMIN_REPORTS_FAST_MOVE_THRESHOLD_MS).length / timings.length
      : 0;

    const result = await this.deepseek.analyze<{
      verdict: string;
      confidence: number;
      flags: string[];
      explanation_pt: string;
    }>(
      AiFeature.MATCH_REPORT,
      'Você é um sistema de detecção de trapaça no xadrez. Analise os dados da partida e retorne JSON com: verdict (CLEAN|SUSPICIOUS|CHEATING), confidence (0-1), flags (array), explanation_pt (texto em português).',
      JSON.stringify({
        pgn: match.pgn?.slice(0, ADMIN_REPORTS_AI_PGN_MAX_CHARS),
        moveCount: moves.length,
        avgMoveMs: Math.round(avgMs),
        fastMovePct: Math.round(fastPct * 100),
        reporterNote: report.reporterNote,
      }),
      id,
      ADMIN_REPORTS_AI_ANALYSIS_SLA_SECONDS,
    );

    if (result) {
      await this.repo.updateReport(id, {
        aiVerdict: result.verdict as any,
        aiConfidence: String(result.confidence),
        aiFlags: result.flags,
        aiExplanation: result.explanation_pt,
        status: (result.verdict !== 'CLEAN' && result.confidence > ADMIN_REPORTS_AI_ESCALATION_CONFIDENCE)
          ? 'UNDER_REVIEW' as any
          : 'COMPLETED' as any,
      });
      return this.repo.findById(id);
    }
    return report;
  }

  async deleteReview(id: string, admin: Pick<AdminUser, 'id' | 'name'>) {
    const review = await this.repo.findReviewById(id);
    if (!review) throw new Error('Review not found');
    await this.repo.deleteReview(id);
    // Recalculate stats for reviewed user
    const { avg, count } = await this.repo.getReviewStatsForUser(review.reviewedId) ?? {} as any;
    await this.repo.updateUserReviewStats(
      review.reviewedId,
      avg ? parseFloat(avg) : null,
      parseInt(count ?? '0', 10),
    );
    this.audit.log(admin, 'REVIEW_DELETED', { targetType: 'Review', targetId: id });
  }
}
