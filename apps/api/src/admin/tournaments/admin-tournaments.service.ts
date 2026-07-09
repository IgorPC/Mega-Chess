import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Tournament, TournamentStatus } from '../../entities/tournament.entity';
import { TransactionType } from '../../entities/wallet-transaction.entity';
import { AdminAuditService } from '../admin-audit.service';
import { AdminUser } from '../../entities/admin-user.entity';
import { DeepseekService } from '../../deepseek/deepseek.service';
import { AiFeature } from '../../entities/ai-usage-log.entity';
import { AdminTournamentsRepository } from './admin-tournaments.repository';
import {
  ADMIN_TOURNAMENTS_DEFAULTS,
  ADMIN_TOURNAMENTS_STATUS_MAP,
  ADMIN_TOURNAMENTS_WHITE_WIN_RESULTS,
  ADMIN_TOURNAMENTS_BLACK_WIN_RESULTS,
} from './consts/endpoints';

function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

@Injectable()
export class AdminTournamentsService {
  private readonly logger = new Logger(AdminTournamentsService.name);

  constructor(
    private readonly repo: AdminTournamentsRepository,
    private readonly audit: AdminAuditService,
    private readonly deepseek: DeepseekService,
  ) {}

  async list(query: { page?: number; limit?: number; status?: string }) {
    const page  = Number(query.page  ?? ADMIN_TOURNAMENTS_DEFAULTS.PAGE);
    const limit = Number(query.limit ?? ADMIN_TOURNAMENTS_DEFAULTS.LIMIT);

    const qb = this.repo.createListQuery()
      .orderBy('t.createdAt', 'DESC')
      .skip(paginate(page, limit).skip)
      .take(limit);

    if (query.status) {
      const statuses = query.status.split(',').map((s) => ADMIN_TOURNAMENTS_STATUS_MAP[s] ?? s);
      qb.where('t.status IN (:...statuses)', { statuses });
    }

    const [rows, total] = await qb.getManyAndCount();

    // Fetch participant counts in one query
    const ids = rows.map((t) => t.id);
    const countRows = ids.length ? await this.repo.queryParticipantCounts(ids) : [];
    const countMap = new Map(countRows.map((r) => [r.tournament_id, parseInt(r.cnt)]));

    const data = rows.map((t) => this.serialize(t, countMap.get(t.id) ?? 0));
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async get(id: string) {
    const t = await this.repo.findTournamentById(id);
    if (!t) throw new NotFoundException('Torneio não encontrado');
    const count = await this.repo.countParticipants(id);
    return this.serialize(t, count);
  }

  async participants(id: string) {
    const rows = await this.repo.createParticipantsQuery()
      .leftJoin('users', 'u', 'u.id = p.user_id')
      .addSelect(['u.nickname', 'u.avatar_url'])
      .where('p.tournament_id = :id', { id })
      .orderBy('p.registered_at', 'ASC')
      .getRawAndEntities();

    return rows.entities.map((p, i) => ({
      userId: p.userId,
      nickname: rows.raw[i]?.u_nickname ?? '',
      avatarUrl: rows.raw[i]?.u_avatar_url ?? null,
      seed: i + 1,
      finalPosition: p.status === 'CHAMPION' ? 1 : p.status === 'SECOND' ? 2 : p.status === 'THIRD' ? 3 : null,
      eliminated: p.status === 'ELIMINATED',
    }));
  }

  async matches(id: string) {
    const rows = await this.repo.createMatchesQuery()
      .innerJoin('matches', 'm', 'm.id = tm.match_id')
      .leftJoin('users', 'w', 'w.id = m.white_player_id')
      .leftJoin('users', 'b', 'b.id = m.black_player_id')
      .addSelect(['tm.id', 'tm.phase', 'm.status', 'm.result', 'w.nickname', 'b.nickname'])
      .where('tm.tournament_id = :id', { id })
      .orderBy('tm.created_at', 'ASC')
      .getRawAndEntities();

    return rows.entities.map((tm, i) => {
      const raw = rows.raw[i] ?? {};
      const result: string | null = raw.m_result ?? null;
      const whiteWins = ADMIN_TOURNAMENTS_WHITE_WIN_RESULTS.includes(result ?? '');
      const blackWins = ADMIN_TOURNAMENTS_BLACK_WIN_RESULTS.includes(result ?? '');
      const winnerNickname = whiteWins ? raw.w_nickname : blackWins ? raw.b_nickname : null;
      return {
        id: tm.id,
        round: tm.phase,
        player1Nickname: raw.w_nickname ?? null,
        player2Nickname: raw.b_nickname ?? null,
        winnerNickname,
        status: raw.m_status ?? 'PENDING',
      };
    });
  }

  async start(id: string, admin: AdminUser) {
    const t = await this.repo.findTournamentById(id);
    if (!t) throw new NotFoundException();
    if (t.status !== TournamentStatus.REGISTERING) {
      throw new BadRequestException('Somente torneios em REGISTERING podem ser iniciados');
    }
    await this.repo.updateTournament(id, { status: TournamentStatus.IN_PROGRESS, startedAt: new Date() });
    this.logger.log(`Tournament started tournamentId=${id} adminId=${admin.id}`);
    this.audit.log(admin, 'TOURNAMENT_STARTED', { targetType: 'tournament', targetId: id });
  }

  async cancel(id: string, admin: AdminUser) {
    const t = await this.repo.findTournamentWithParticipants(id);
    if (!t) throw new NotFoundException();
    if (![TournamentStatus.REGISTERING, TournamentStatus.IN_PROGRESS].includes(t.status)) {
      throw new BadRequestException('Torneio já finalizado ou cancelado');
    }

    // Estornar buy-ins apenas de participantes que já pagaram
    for (const p of (t.participants ?? []).filter(p => p.hasEntryDebited)) {
      const wallet = await this.repo.findWalletByUserId(p.userId);
      if (!wallet) continue;
      const entryFee = t.entryFeeCc;
      if (entryFee <= 0) continue;
      const newBalance = (parseFloat(wallet.balance) + entryFee).toFixed(2);
      await this.repo.updateWalletBalance(p.userId, newBalance);
      await this.repo.saveTransaction(this.repo.createTransaction({
        userId: p.userId,
        type: TransactionType.REFUND,
        amount: entryFee.toString(),
        balanceAfter: newBalance,
        referenceId: id,
        description: `Torneio cancelado: estorno buy-in`,
      }));
    }

    await this.repo.updateTournament(id, { status: TournamentStatus.CANCELLED, finishedAt: new Date() });
    this.logger.log(`Tournament cancelled tournamentId=${id} adminId=${admin.id}`);
    this.audit.log(admin, 'TOURNAMENT_CANCELLED', { targetType: 'tournament', targetId: id });
  }

  async removeParticipant(tournamentId: string, userId: string, admin: AdminUser) {
    const t = await this.repo.findTournamentById(tournamentId);
    if (!t) throw new NotFoundException();
    if (t.status !== TournamentStatus.REGISTERING) {
      throw new BadRequestException('Só é possível remover participantes de torneios em REGISTERING');
    }
    const p = await this.repo.findParticipant(tournamentId, userId);
    if (!p) throw new NotFoundException('Participante não encontrado');

    await this.repo.deleteParticipant(tournamentId, userId);

    // Estornar buy-in apenas se o participante já pagou
    if (p.hasEntryDebited && t.entryFeeCc > 0) {
      const wallet = await this.repo.findWalletByUserId(userId);
      if (wallet) {
        const newBalance = (parseFloat(wallet.balance) + t.entryFeeCc).toFixed(2);
        await this.repo.updateWalletBalance(userId, newBalance);
        await this.repo.saveTransaction(this.repo.createTransaction({
          userId,
          type: TransactionType.REFUND,
          amount: t.entryFeeCc.toString(),
          balanceAfter: newBalance,
          referenceId: tournamentId,
          description: 'Removido do torneio pelo admin — estorno buy-in',
        }));
      }
    }

    this.audit.log(admin, 'TOURNAMENT_PARTICIPANT_REMOVED', {
      targetType: 'tournament', targetId: tournamentId, details: `userId: ${userId}`,
    });
  }

  async matchMoves(tournamentMatchId: string) {
    const tm = await this.repo.findTournamentMatchWithMatch(tournamentMatchId);

    if (!tm) throw new NotFoundException('Partida não encontrada');

    const match = tm.match as any;
    return {
      id: tm.id,
      timeControl: tm.timeControl,
      result: match?.result ?? null,
      whiteNickname: match?.whitePlayer?.nickname ?? null,
      blackNickname: match?.blackPlayer?.nickname ?? null,
      clockWhiteMs: tm.clockWhiteMs,
      clockBlackMs: tm.clockBlackMs,
      moves: tm.moveTimestamps,
      aiAnalysis: tm.aiAnalysis ?? null,
    };
  }

  async analyzeMatchWithAi(tournamentMatchId: string) {
    const data = await this.matchMoves(tournamentMatchId);

    if (!data.moves.length) {
      return { verdict: 'NO_DATA', explanation: 'Esta partida não possui histórico de jogadas registrado.', suspicious: false };
    }

    const SYSTEM_PROMPT = `Você é um especialista em análise anti-trapaça para xadrez competitivo online.
Sua tarefa é analisar o histórico de jogadas de uma partida e determinar se há sinais de trapaça (uso de engine de xadrez, comportamento automatizado, etc.).

# Como ler os dados de jogadas
Cada jogada contém:
- san: notação algébrica da jogada (ex: e4, Nf3, O-O)
- from/to: posição de origem e destino (ex: e2→e4)
- piece: peça movida (p=peão, n=cavalo, b=bispo, r=torre, q=rainha, k=rei)
- captured: peça capturada, se houver
- fen: posição do tabuleiro após a jogada
- elapsed_ms: tempo gasto nesta jogada em milissegundos
- clock_ms: tempo restante no relógio após a jogada
- player: qual jogador fez a jogada (white/black)

# Critérios para identificar trapaça

## Tempo de resposta suspeito
- Jogadas consistentemente abaixo de 1.500ms (1,5 segundos) são altamente suspeitas — tempo humano mínimo razoável é 2-3s
- Variância muito baixa no tempo de resposta sugere automação (humanos variam naturalmente)
- Ausência de "tempo de pensamento" em posições táticas complexas é suspeito

## Qualidade das jogadas
- Sequências longas de jogadas que correspondem às melhores opções de engine (top-1 engine move por muitos lances consecutivos)
- Encontrar defesas complexas e contra-ataques de forma consistente sem hesitação
- Jogar as melhores capturas sempre, mesmo em posições com múltiplas opções plausíveis

## Padrões comportamentais
- Tempo de resposta AUMENTANDO quando a posição é fácil e DIMINUINDO quando é complexa (comportamento inverso ao humano)
- Tempo de resposta muito uniforme, como se houvesse delay artificial fixo
- Jogadas instantâneas (<500ms) em qualquer posição de média/alta complexidade

## Contexto financeiro
- Esta é uma partida de duelo com stake financeiro (Chess Coins) — o incentivo para trapaça é real

# Formato de resposta (JSON obrigatório)
{
  "verdict": "CLEAN" | "SUSPICIOUS" | "CHEATING",
  "confidence": 0-100,
  "suspicious": true | false,
  "summary": "Resumo curto em 1-2 frases",
  "explanation": "Análise detalhada em português com evidências específicas",
  "flags": ["lista de sinais identificados"],
  "whiteAnalysis": { "avgElapsedMs": number, "minElapsedMs": number, "suspiciousMovesCount": number, "notes": "string" },
  "blackAnalysis": { "avgElapsedMs": number, "minElapsedMs": number, "suspiciousMovesCount": number, "notes": "string" }
}`;

    const whiteMoves = data.moves.filter(m => m.player === 'white');
    const blackMoves = data.moves.filter(m => m.player === 'black');

    const formatMoves = (moves: typeof data.moves) =>
      moves.map((m, i) => `${i + 1}. ${m.san} [${m.elapsed_ms}ms restante:${m.clock_ms}ms]`).join('\n');

    const RESULT_DESCRIPTIONS: Record<string, string> = {
      WHITE_WINS:    'Vitória das Brancas por xeque-mate',
      BLACK_WINS:    'Vitória das Pretas por xeque-mate',
      DRAW:          'Empate',
      FORFEIT_WHITE: 'DESISTÊNCIA — as Brancas desistiram voluntariamente (clicaram em resignar). NÃO é trapaça. A análise de tempo é irrelevante pois a partida foi encerrada manualmente.',
      FORFEIT_BLACK: 'DESISTÊNCIA — as Pretas desistiram voluntariamente (clicaram em resignar). NÃO é trapaça. A análise de tempo é irrelevante pois a partida foi encerrada manualmente.',
      TIMEOUT_WHITE: 'Derrota das Brancas por esgotamento de tempo (relógio zerou)',
      TIMEOUT_BLACK: 'Derrota das Pretas por esgotamento de tempo (relógio zerou)',
    };
    const resultDescription = RESULT_DESCRIPTIONS[data.result ?? ''] ?? (data.result ?? 'em andamento');

    const USER_PROMPT = `# Partida a analisar
- Controle de tempo: ${data.timeControl}
- Resultado: ${resultDescription}
- Brancas: ${data.whiteNickname ?? 'desconhecido'} (relógio final: ${data.clockWhiteMs ?? '?'}ms)
- Pretas: ${data.blackNickname ?? 'desconhecido'} (relógio final: ${data.clockBlackMs ?? '?'}ms)
- Total de jogadas: ${data.moves.length}

## Jogadas das Brancas (${whiteMoves.length} jogadas)
${formatMoves(whiteMoves) || 'Nenhuma jogada registrada'}

## Jogadas das Pretas (${blackMoves.length} jogadas)
${formatMoves(blackMoves) || 'Nenhuma jogada registrada'}

Analise ambos os jogadores e retorne o JSON conforme especificado.`;

    type AiResult = {
      verdict: string;
      confidence: number;
      suspicious: boolean;
      summary: string;
      explanation: string;
      flags: string[];
      whiteAnalysis: { avgElapsedMs: number; minElapsedMs: number; suspiciousMovesCount: number; notes: string };
      blackAnalysis: { avgElapsedMs: number; minElapsedMs: number; suspiciousMovesCount: number; notes: string };
    };

    const result = await this.deepseek.analyze<AiResult>(
      AiFeature.TOURNAMENT_FRAUD_CHECK,
      SYSTEM_PROMPT,
      USER_PROMPT,
      tournamentMatchId,
      4000,
    );

    if (!result) {
      return { verdict: 'ERROR', explanation: 'Serviço de IA indisponível no momento.', suspicious: false };
    }

    // Persist so subsequent loads don't require re-analysis
    await this.repo.updateTournamentMatch(tournamentMatchId, { aiAnalysis: result as unknown as Record<string, unknown> });

    return result;
  }

  async listDuels(query: { page?: number; limit?: number; view: 'active' | 'finished' }) {
    const page  = Number(query.page  ?? ADMIN_TOURNAMENTS_DEFAULTS.PAGE);
    const limit = Number(query.limit ?? ADMIN_TOURNAMENTS_DEFAULTS.LIMIT);

    const statuses = query.view === 'active'
      ? [TournamentStatus.REGISTERING, TournamentStatus.IN_PROGRESS]
      : [TournamentStatus.FINISHED, TournamentStatus.CANCELLED];

    const [rows, total] = await this.repo.findDuels(statuses, page, limit);

    // Fetch champion nicknames via champion_id on the tournament row (set directly by finalizeDuel)
    const championIds = rows.map((t) => t.championId).filter(Boolean) as string[];
    const championUsers = championIds.length ? await this.repo.queryChampionNicknames(championIds) : [];
    const userNickMap = new Map(championUsers.map((u) => [u.id, u.nickname]));

    const data = rows.map((t) => ({
      id: t.id,
      type: t.type,
      timeControl: t.timeControl,
      entryFee: t.entryFeeCc,
      prizePool: t.prizePoolCc,
      rake: t.rakeCc,
      maxPlayers: t.maxPlayers,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      startedAt: t.startedAt?.toISOString() ?? null,
      finishedAt: t.finishedAt?.toISOString() ?? null,
      winnerNickname: t.championId ? (userNickMap.get(t.championId) ?? null) : null,
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  private serialize(t: Tournament, registeredCount: number) {
    return {
      id: t.id,
      name: `${t.type} — ${t.timeControl}`,
      status: this.mapStatus(t.status),
      format: 'SINGLE_ELIMINATION',
      buyIn: t.entryFeeCc,
      prizePool: t.prizePoolCc,
      maxPlayers: t.maxPlayers,
      registeredCount,
      timeControl: t.timeControl,
      isRated: true,
      startAt: t.startedAt?.toISOString() ?? t.createdAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
    };
  }

  private mapStatus(s: TournamentStatus): string {
    if (s === TournamentStatus.REGISTERING) return 'OPEN';
    if (s === TournamentStatus.FINISHED)    return 'COMPLETED';
    return s; // IN_PROGRESS, CANCELLED
  }
}
