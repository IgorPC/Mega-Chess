import {
  Injectable, BadRequestException, NotFoundException,
  ForbiddenException, Logger, OnModuleInit, OnModuleDestroy,
  Inject, forwardRef,
} from '@nestjs/common';
import { Repository, DataSource, In, ILike, MoreThan } from 'typeorm';
import { TournamentsRepository } from './tournaments.repository';
import * as bcrypt from 'bcrypt';
import {
  Tournament, TournamentType, TournamentStatus,
  DUEL_CONFIG, DuelEntryFee, calcCreationFee, calcPrizes,
  TournamentBracket, BracketMatch, BracketRound, RAKE_RATE,
} from '../entities/tournament.entity';
import {
  TournamentParticipant, ParticipantStatus,
} from '../entities/tournament-participant.entity';
import {
  TournamentMatch, TournamentPhase, MoveTimestamp, TiebreakResult,
} from '../entities/tournament-match.entity';
import { Match, MatchResult } from '../entities/match.entity';
import { User } from '../entities/user.entity';
import { WalletService } from '../wallet/wallet.service';
import { TransactionType } from '../entities/wallet-transaction.entity';
import { MatchesService } from '../matches/matches.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../entities/notification.entity';
import { DeepseekService } from '../deepseek/deepseek.service';
import { AiFeature } from '../entities/ai-usage-log.entity';
import { PlatformRevenueService } from '../platform-revenue/platform-revenue.service';
import { PlatformRevenueType } from '../platform-revenue/entities/platform-revenue.entity';
import { CreateCustomTournamentDto, JoinTournamentDto } from './dtos/create-tournament.dto';
import { ListTournamentsDto, TournamentSortField, SortOrder } from './dtos/list-tournaments.dto';
import {
  STAGNATION_WARN_MS,
  STAGNATION_KILL_MS,
  AI_FRAUD_TIMEOUT_MS,
  NEXT_MATCH_DELAY_MS,
  DUEL_INVITE_TTL_MS,
  STAGNATION_CHECK_INTERVAL_MS,
} from './consts/tournaments.consts';
import { calculateAge, MINIMUM_DUEL_AGE } from '../common/age.util';

/** Fase a partir do número de partidas simultâneas */
function phaseForRound(totalRounds: number, round: number): TournamentPhase {
  const remaining = totalRounds - round; // 0 = final round
  if (remaining === 0) return TournamentPhase.FINAL;
  if (remaining === 1) return TournamentPhase.SEMIFINAL;
  if (remaining === 2) return TournamentPhase.QUARTERFINAL;
  if (round === 1) return TournamentPhase.ROUND_1;
  if (round === 2) return TournamentPhase.ROUND_2;
  if (round === 3) return TournamentPhase.ROUND_3;
  if (round === 4) return TournamentPhase.ROUND_4;
  return TournamentPhase.ROUND_5;
}

/**
 * Calcula valor de material de uma posição FEN.
 * Peão=1, Cavalo/Bispo=3, Torre=5, Dama=9 (Rei não conta).
 */
function materialScore(fen: string, color: 'w' | 'b'): number {
  const pieceValues: Record<string, number> = {
    p: 1, n: 3, b: 3, r: 5, q: 9,
  };
  const board = fen.split(' ')[0];
  let score = 0;
  for (const ch of board) {
    const isWhite = ch === ch.toUpperCase();
    const lower   = ch.toLowerCase();
    if (lower in pieceValues && (color === 'w' ? isWhite : !isWhite)) {
      score += pieceValues[lower];
    }
  }
  return score;
}

/**
 * Embaralha array usando seed determinístico (tournament_id).
 * Garante reproducibilidade e auditabilidade do sorteio.
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  // Deriva número inteiro do UUID removendo hífens
  let hash = parseInt(seed.replace(/-/g, '').slice(0, 8), 16);
  for (let i = result.length - 1; i > 0; i--) {
    hash = (hash * 1664525 + 1013904223) >>> 0; // LCG
    const j = hash % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

@Injectable()
export class TournamentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TournamentsService.name);

  /** Mapa de bracket WebSocket: tournamentId → callback para emitir evento */
  bracketUpdateEmitter: ((tournamentId: string, bracket: TournamentBracket) => void) | null = null;

  /** Notifica jogadores sobre nova partida de torneio */
  matchFoundEmitter: ((player1Id: string, player2Id: string, matchId: string, match: any) => void) | null = null;

  /** Emite countdown da próxima rodada para todos na sala */
  nextRoundEmitter: ((tournamentId: string, seconds: number) => void) | null = null;

  /** Notifica sala que torneio finalizou com dados atualizados */
  tournamentFinishedEmitter: ((tournamentId: string, tournament: any) => void) | null = null;

  /** Notifica lista pública de torneios quando contagem de jogadores muda */
  listUpdateEmitter: ((tournamentId: string, currentPlayers: number) => void) | null = null;

  /** Envia convite de duelo em tempo real para o amigo */
  duelInviteEmitter: ((userId: string, data: object) => void) | null = null;

  private stagnationInterval: NodeJS.Timeout | null = null;

  private readonly tournaments: Repository<Tournament>;
  private readonly participants: Repository<TournamentParticipant>;
  private readonly tournamentMatches: Repository<TournamentMatch>;
  private readonly matches: Repository<Match>;
  private readonly users: Repository<User>;
  private readonly dataSource: DataSource;

  constructor(
    private readonly repo: TournamentsRepository,
    @Inject(forwardRef(() => WalletService)) private wallet: WalletService,
    private matchesSvc: MatchesService,
    private notifications: NotificationsService,
    private deepseek: DeepseekService,
    private platformRevenue: PlatformRevenueService,
  ) {
    this.tournaments = repo.tournaments;
    this.participants = repo.participants;
    this.tournamentMatches = repo.tournamentMatches;
    this.matches = repo.matches;
    this.users = repo.users;
    this.dataSource = repo.dataSource;
  }

  onModuleInit() {
    // Verifica stagnation a cada 30 minutos
    this.stagnationInterval = setInterval(
      () => this.runStagnationCleanup().catch(e => this.logger.error('stagnation', e)),
      STAGNATION_CHECK_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.stagnationInterval) clearInterval(this.stagnationInterval);
  }

  // ─── 1v1 Duel — Invite ───────────────────────────────────────────────────

  /** Called when accepting a duel invite (tournament already exists, status = REGISTERING). */
  private async startDuel(
    tournament: Tournament,
    whiteId: string,
    blackId: string,
    entryFee: number,
  ) {
    await this.wallet.debit(
      blackId, entryFee, TransactionType.ENTRY_RESERVE,
      tournament.id, `Reserva para Duelo — ${entryFee} CC`,
    );

    await this.participants.save(
      this.participants.create({
        tournamentId: tournament.id, userId: blackId,
        status: ParticipantStatus.ACTIVE,
        entryFeePaid: entryFee, hasEntryDebited: true,
      }),
    );
    await this.participants.update(
      { tournamentId: tournament.id, userId: whiteId },
      { status: ParticipantStatus.ACTIVE },
    );

    const total     = entryFee * 2;
    const prizePool = Math.floor(total * (1 - RAKE_RATE));
    const rake      = total - prizePool;

    await this.tournaments.update(tournament.id, {
      status: TournamentStatus.IN_PROGRESS,
      prizePoolCc: prizePool, rakeCc: rake, startedAt: new Date(),
    });

    const match = await this.matchesSvc.createMatch(whiteId, blackId);
    await this.tournamentMatches.save(
      this.tournamentMatches.create({
        tournamentId: tournament.id, matchId: match.id,
        phase: TournamentPhase.DUEL, roundNumber: 1,
        timeControl: tournament.timeControl,
        whitePrize: 0, blackPrize: 0,
      }),
    );

    const [p1, p2] = await Promise.all([
      this.users.findOne({ where: { id: whiteId }, select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
      this.users.findOne({ where: { id: blackId },  select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
    ]);
    this.emitMatchFound(whiteId, blackId, match.id, { ...match, whitePlayer: p1, blackPlayer: p2 });

    return { status: 'matched' as const, tournamentId: tournament.id, matchId: match.id };
  }


  private async assertAdultForDuel(userId: string) {
    const user = await this.users.findOne({ where: { id: userId }, select: ['id', 'birthDate'] });
    if (!user?.birthDate || calculateAge(user.birthDate) < MINIMUM_DUEL_AGE) {
      throw new BadRequestException('É necessário ter ao menos 18 anos e informar sua data de nascimento no perfil para participar de duelos');
    }
  }

  async inviteFriend(
    inviterId: string,
    friendId: string,
    type: TournamentType.DUEL_FLASH | TournamentType.DUEL_GIANT,
    entryFee: DuelEntryFee,
  ) {
    await this.assertAdultForDuel(inviterId);
    const cfg = DUEL_CONFIG[type];
    const tournament = await this.tournaments.save(
      this.tournaments.create({
        type, entryFeeCc: entryFee, timeControl: cfg.timeControl,
        maxPlayers: 2, name: null, creatorId: null, isPrivate: false,
        isFlexible: false, creationFeeCc: 0,
      }),
    );

    await this.wallet.debit(
      inviterId, entryFee, TransactionType.ENTRY_RESERVE,
      tournament.id, `Reserva para convite de Duelo — ${entryFee} CC`,
    );
    await this.participants.save(
      this.participants.create({
        tournamentId: tournament.id, userId: inviterId,
        entryFeePaid: entryFee, hasEntryDebited: true,
      }),
    );

    const inviter = await this.users.findOne({ where: { id: inviterId } });
    const expiresAt = new Date(Date.now() + DUEL_INVITE_TTL_MS).toISOString();
    const invitePayload = {
      tournamentId: tournament.id,
      inviterId,
      inviterNickname: inviter?.nickname,
      type, entryFee,
      timeControl: cfg.timeControl,
      expiresAt,
    };

    const notification = await this.notifications.create(friendId, NotificationType.DUEL_INVITE, invitePayload);

    // Real-time popup via WebSocket
    this.duelInviteEmitter?.(friendId, { ...invitePayload, notificationId: notification.id });

    setTimeout(() => this.cancelDuelInvite(tournament.id), DUEL_INVITE_TTL_MS);
    return { tournamentId: tournament.id };
  }

  async acceptDuelInvite(acceptorId: string, tournamentId: string) {
    const tournament = await this.tournaments.findOne({
      where: { id: tournamentId, status: TournamentStatus.REGISTERING },
      relations: ['participants'],
    });
    if (!tournament) throw new NotFoundException('Convite expirado ou não encontrado');
    const inviter = tournament.participants[0];
    if (!inviter) throw new BadRequestException('Convite inválido');
    if (inviter.userId === acceptorId) throw new ForbiddenException('Você não pode aceitar seu próprio convite');
    await this.assertAdultForDuel(acceptorId);
    // Mark related duel invite notification as read
    await this.notifications.markDuelInviteRead(acceptorId, tournamentId);
    return this.startDuel(tournament, inviter.userId, acceptorId, tournament.entryFeeCc);
  }

  async declineDuelInvite(userId: string, tournamentId: string) {
    await this.notifications.markDuelInviteRead(userId, tournamentId);
    await this.cancelDuelInvite(tournamentId);
    return { status: 'declined' };
  }

  private async cancelDuelInvite(tournamentId: string) {
    const t = await this.tournaments.findOne({
      where: { id: tournamentId, status: TournamentStatus.REGISTERING },
    });
    if (!t) return;
    await this.tournaments.update(tournamentId, { status: TournamentStatus.CANCELLED });
    const p = await this.participants.findOne({ where: { tournamentId, hasEntryDebited: true } });
    if (p) {
      await this.wallet.credit(
        p.userId, t.entryFeeCc, TransactionType.ENTRY_RELEASE,
        tournamentId, 'Convite de duelo expirado/recusado — CC liberados',
      );
      // Mark the friend's pending duel invite notification as read
      await this.notifications.markDuelInviteReadByTournament(tournamentId).catch(() => {});
    }
  }

  // ─── Torneios criados por jogadores ──────────────────────────────────────

  async createCustomTournament(creatorId: string, dto: CreateCustomTournamentDto) {
    const creationFee = calcCreationFee(dto.entryFee);

    // Verifica saldo: taxa de criação + entry fee
    const requiredBalance = creationFee + dto.entryFee;
    await this.wallet.assertBalance(creatorId, requiredBalance);

    const passwordHash = dto.isPrivate && dto.password
      ? await bcrypt.hash(dto.password, 10)
      : null;

    const tournament = await this.dataSource.transaction(async (em) => {
      const t = await em.save(Tournament, em.create(Tournament, {
        type: TournamentType.USER_CREATED,
        name: dto.name,
        creatorId,
        entryFeeCc: dto.entryFee,
        creationFeeCc: creationFee,
        timeControl: dto.timeControl,
        maxPlayers: dto.maxPlayers,
        isPrivate: dto.isPrivate,
        passwordHash,
        isFlexible: dto.isFlexible ?? false,
      }));

      // Debita taxa de criação imediatamente (não-reembolsável)
      await this.wallet.debitTx(
        em, creatorId, creationFee,
        TransactionType.TOURNAMENT_CREATION_FEE,
        t.id, `Taxa de criação do torneio "${dto.name}"`,
      );

      if (creationFee > 0) {
        this.platformRevenue.record(
          PlatformRevenueType.CREATION_FEE,
          creationFee,
          t.id,
          `Taxa de criação do torneio "${dto.name}"`,
        );
      }

      // Inscreve o criador (sem débito de entry ainda)
      await em.save(TournamentParticipant, em.create(TournamentParticipant, {
        tournamentId: t.id, userId: creatorId,
        status: ParticipantStatus.REGISTERED,
        entryFeePaid: dto.entryFee, hasEntryDebited: false,
        invitedByCreator: false,
      }));

      return t;
    });

    return this.tournamentPublicView(tournament);
  }

  async joinCustomTournament(userId: string, tournamentId: string, dto: JoinTournamentDto) {
    const tournament = await this.tournaments.findOne({
      where: { id: tournamentId, status: TournamentStatus.REGISTERING },
      relations: ['participants'],
    });
    if (!tournament) throw new NotFoundException('Torneio não encontrado ou não está aceitando inscrições');
    if (tournament.type !== TournamentType.USER_CREATED) {
      throw new BadRequestException('Use o endpoint correto para este tipo de torneio');
    }

    const REMOVABLE_STATUSES = [ParticipantStatus.KICKED, ParticipantStatus.LEFT];
    const existingStale = tournament.participants.find(
      p => p.userId === userId && REMOVABLE_STATUSES.includes(p.status),
    );
    const alreadyIn = tournament.participants.some(
      p => p.userId === userId && !REMOVABLE_STATUSES.includes(p.status),
    );
    if (alreadyIn) throw new BadRequestException('Você já está inscrito neste torneio');
    // Remove registro KICKED ou LEFT para permitir reinscrição
    if (existingStale) await this.participants.remove(existingStale);

    const activeCount = tournament.participants.filter(
      p => !REMOVABLE_STATUSES.includes(p.status),
    ).length;
    if (activeCount >= tournament.maxPlayers) throw new BadRequestException('Torneio lotado');

    // Verifica senha se privado e não foi convidado
    if (tournament.isPrivate) {
      const invited = await this.participants.findOne({
        where: { tournamentId, userId, invitedByCreator: true },
      });
      if (!invited) {
        if (!dto.password) throw new ForbiddenException('Este torneio é privado. Informe a senha.');
        const valid = await bcrypt.compare(dto.password, tournament.passwordHash ?? '');
        if (!valid) throw new ForbiddenException('Senha incorreta');
      }
    }

    // Verifica saldo (débito será feito no início, mas bloqueia se insuficiente)
    await this.wallet.assertBalance(userId, tournament.entryFeeCc);

    const participant = await this.participants.save(
      this.participants.create({
        tournamentId, userId,
        status: ParticipantStatus.REGISTERED,
        entryFeePaid: tournament.entryFeeCc,
        hasEntryDebited: false,
      }),
    );

    const newCount = activeCount + 1;
    setImmediate(() => {
      this.emitRoomUpdateWithParticipants(tournamentId, 'PLAYER_JOINED', { userId, count: newCount }).catch(() => {});
      this.listUpdateEmitter?.(tournamentId, newCount);
    });

    // Notifica quando quase cheio (80%)
    if (newCount / tournament.maxPlayers >= 0.8 && newCount < tournament.maxPlayers) {
      await this.notifyParticipantsAlmostFull(tournament, newCount);
    }

    if (newCount >= tournament.maxPlayers) {
      setImmediate(() =>
        this.startCustomTournament(tournamentId).catch(e => this.logger.error('start tournament', e)),
      );
    }

    return { participantId: participant.id, tournamentId };
  }

  async leaveCustomTournament(userId: string, tournamentId: string) {
    const tournament = await this.tournaments.findOne({
      where: { id: tournamentId, status: TournamentStatus.REGISTERING },
    });
    if (!tournament) throw new BadRequestException('Torneio não encontrado ou já iniciado');

    const participant = await this.participants.findOne({
      where: { tournamentId, userId, status: ParticipantStatus.REGISTERED },
    });
    if (!participant) throw new NotFoundException('Você não está inscrito neste torneio');

    await this.participants.remove(participant);
    setImmediate(async () => {
      this.emitRoomUpdateWithParticipants(tournamentId, 'PLAYER_LEFT', { userId }).catch(() => {});
      const remaining = await this.participants.count({ where: { tournamentId } });
      this.listUpdateEmitter?.(tournamentId, remaining);
    });
    return { status: 'left' };
  }

  async kickParticipant(creatorId: string, tournamentId: string, targetUserId: string) {
    const tournament = await this.tournaments.findOne({
      where: { id: tournamentId, status: TournamentStatus.REGISTERING, creatorId },
    });
    if (!tournament) throw new ForbiddenException('Torneio não encontrado ou você não é o criador');
    if (targetUserId === creatorId) throw new BadRequestException('O criador não pode se expulsar');

    const participant = await this.participants.findOne({
      where: { tournamentId, userId: targetUserId },
    });
    if (!participant) throw new NotFoundException('Participante não encontrado');

    await this.participants.update(participant.id, { status: ParticipantStatus.KICKED });

    await this.notifications.create(targetUserId, NotificationType.TOURNAMENT_KICKED, {
      tournamentId,
      tournamentName: tournament.name,
    });

    setImmediate(async () => {
      this.emitRoomUpdateWithParticipants(tournamentId, 'PLAYER_KICKED', { userId: targetUserId }).catch(() => {});
      const remaining = await this.participants.count({ where: { tournamentId, status: ParticipantStatus.REGISTERED } });
      this.listUpdateEmitter?.(tournamentId, remaining);
    });
    return { status: 'kicked' };
  }

  async cancelCustomTournament(userId: string, tournamentId: string) {
    const tournament = await this.tournaments.findOne({
      where: { id: tournamentId, status: TournamentStatus.REGISTERING },
    });
    if (!tournament) throw new NotFoundException('Torneio não encontrado ou já iniciado');

    const isAdmin = false; // preenchido pelo guard se vier do admin module
    if (tournament.creatorId !== userId && !isAdmin) {
      throw new ForbiddenException('Apenas o criador pode cancelar o torneio');
    }

    await this.tournaments.update(tournamentId, { status: TournamentStatus.CANCELLED });

    // Nenhum débito de entry foi feito — apenas notifica participantes
    const parts = await this.participants.find({ where: { tournamentId } });
    await Promise.all(parts.map(p =>
      this.notifications.create(p.userId, NotificationType.TOURNAMENT_CANCELLED, {
        tournamentId, tournamentName: tournament.name,
      }),
    ));

    return { status: 'cancelled' };
  }

  /** Cancela torneio pelo admin (sem checar creatorId) */
  async adminCancelTournament(tournamentId: string) {
    const tournament = await this.tournaments.findOne({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Torneio não encontrado');
    if (tournament.status === TournamentStatus.IN_PROGRESS) {
      // Reembolsa todos os participantes que já pagaram
      const parts = await this.participants.find({
        where: { tournamentId, hasEntryDebited: true },
      });
      await Promise.all(parts.map(p =>
        this.wallet.credit(
          p.userId, p.entryFeePaid, TransactionType.REFUND,
          tournamentId, `Reembolso — torneio "${tournament.name}" cancelado pelo admin`,
        ),
      ));
    }
    await this.tournaments.update(tournamentId, { status: TournamentStatus.CANCELLED });
    return { status: 'cancelled' };
  }

  // ─── Convites para torneio privado ───────────────────────────────────────

  async inviteByNickname(creatorId: string, tournamentId: string, nickname: string) {
    const tournament = await this.tournaments.findOne({
      where: { id: tournamentId, creatorId, status: TournamentStatus.REGISTERING },
    });
    if (!tournament) throw new ForbiddenException('Torneio não encontrado ou você não é o criador');

    const target = await this.users.findOne({ where: { nickname } });
    if (!target) throw new NotFoundException(`Jogador "${nickname}" não encontrado`);

    const alreadyIn = await this.participants.findOne({
      where: { tournamentId, userId: target.id },
    });
    if (alreadyIn) throw new BadRequestException('Jogador já está inscrito ou foi convidado');

    // Cria participante com flag de convite (sem débito)
    await this.participants.save(
      this.participants.create({
        tournamentId, userId: target.id,
        status: ParticipantStatus.REGISTERED,
        entryFeePaid: tournament.entryFeeCc,
        hasEntryDebited: false,
        invitedByCreator: true,
      }),
    );

    const prizes = calcPrizes(tournament.maxPlayers, tournament.entryFeeCc);
    await this.notifications.create(target.id, NotificationType.TOURNAMENT_INVITE, {
      tournamentId,
      tournamentName: tournament.name,
      creatorNickname: (await this.users.findOne({ where: { id: creatorId } }))?.nickname,
      entryFee: tournament.entryFeeCc,
      maxPlayers: tournament.maxPlayers,
      timeControl: tournament.timeControl,
      isPrivate: tournament.isPrivate,
      prizes: { first: prizes.first, second: prizes.second, third: prizes.third },
    });

    return { status: 'invited' };
  }

  async inviteFriendToTournament(creatorId: string, tournamentId: string, friendId: string) {
    const friend = await this.users.findOne({ where: { id: friendId } });
    if (!friend) throw new NotFoundException('Amigo não encontrado');
    return this.inviteByNickname(creatorId, tournamentId, friend.nickname);
  }

  // ─── Início do torneio ───────────────────────────────────────────────────

  async manuallyStartTournament(userId: string, tournamentId: string) {
    const tournament = await this.tournaments.findOne({
      where: { id: tournamentId },
      relations: ['participants'],
    });
    if (!tournament) throw new NotFoundException('Torneio não encontrado');
    if (tournament.creatorId !== userId) throw new ForbiddenException('Apenas o criador pode iniciar o torneio');
    if (tournament.status !== TournamentStatus.REGISTERING) {
      throw new BadRequestException('O torneio já foi iniciado ou cancelado');
    }
    const activeCount = tournament.participants.filter(p => p.status !== ParticipantStatus.KICKED).length;
    if (activeCount < 4) throw new BadRequestException('São necessários pelo menos 4 jogadores para iniciar');
    if (!tournament.isFlexible && activeCount < tournament.maxPlayers) {
      throw new BadRequestException('O torneio ainda não está completo');
    }
    await this.startCustomTournament(tournamentId);
    return { status: 'started' };
  }

  private async startCustomTournament(tournamentId: string) {
    const tournament = await this.tournaments.findOne({
      where: { id: tournamentId },
      relations: ['participants'],
    });
    if (!tournament || tournament.status !== TournamentStatus.REGISTERING) return;

    const activePlayers = tournament.participants.filter(
      p => p.status !== ParticipantStatus.KICKED,
    );

    let bracketSize = activePlayers.length;

    if (tournament.isFlexible) {
      // Maior potência de 2 que cabe nos participantes
      bracketSize = Math.pow(2, Math.floor(Math.log2(activePlayers.length)));
    }

    if (!this.isPowerOfTwo(bracketSize) || bracketSize < 4) {
      this.logger.warn(`Cannot start tournament ${tournamentId}: ${bracketSize} players not valid`);
      return;
    }

    // Para modo flexível, remove excedentes por ordem de inscrição (FIFO)
    const playersInBracket = activePlayers
      .sort((a, b) => a.registeredAt.getTime() - b.registeredAt.getTime())
      .slice(0, bracketSize);

    // Debita entry fee de todos os participantes do bracket
    await this.dataSource.transaction(async (em) => {
      for (const p of playersInBracket) {
        if (!p.hasEntryDebited) {
          await this.wallet.debitTx(
            em, p.userId, p.entryFeePaid,
            TransactionType.TOURNAMENT_ENTRY,
            tournamentId,
            `Inscrição no torneio "${tournament.name}"`,
          );
          await em.update(TournamentParticipant, p.id, { hasEntryDebited: true, status: ParticipantStatus.ACTIVE });
        }
      }

      const prizes = calcPrizes(bracketSize, tournament.entryFeeCc);
      await em.update(Tournament, tournamentId, {
        status: TournamentStatus.IN_PROGRESS,
        prizePoolCc: prizes.prizePool,
        rakeCc: prizes.rake,
        startedAt: new Date(),
      });
    });

    // Gera bracket e cria partidas da primeira rodada
    const shuffled   = seededShuffle(playersInBracket, tournamentId);
    const totalRounds = Math.log2(bracketSize);
    const bracket    = this.buildBracket(shuffled, totalRounds, tournamentId);

    await this.tournaments.update(tournamentId, { bracketData: bracket });
    this.emitBracketUpdate(tournamentId, bracket);

    // Notifica participantes
    await Promise.all(playersInBracket.map(p =>
      this.notifications.create(p.userId, NotificationType.TOURNAMENT_STARTED, {
        tournamentId, tournamentName: tournament.name,
      }),
    ));

    // Salva posição no bracket
    await Promise.all(shuffled.map((p, i) =>
      this.participants.update(p.id, { bracketPosition: i }),
    ));

    // Cria partidas da rodada 1
    await this.createRoundMatches(tournament, bracket, 1);
  }

  private buildBracket(
    players: TournamentParticipant[],
    totalRounds: number,
    tournamentId: string,
  ): TournamentBracket {
    const rounds: BracketRound[] = [];

    // Rodada 1: pareia jogadores em sequência
    const r1Matches: BracketMatch[] = [];
    for (let i = 0; i < players.length; i += 2) {
      r1Matches.push({
        bracketId: `R1M${i / 2}`,
        player1Id: players[i].userId,
        player2Id: players[i + 1].userId,
        winnerId: null, loserId: null, matchId: null, tiebreakResult: null,
      });
    }
    rounds.push({
      roundNumber: 1,
      phase: phaseForRound(totalRounds, 1),
      matches: r1Matches,
    });

    // Rodadas 2..N: slots vazios (preenchidos conforme vencedores avançam)
    for (let r = 2; r <= totalRounds; r++) {
      const matchCount = players.length / Math.pow(2, r);
      const matches: BracketMatch[] = Array.from({ length: matchCount }, (_, i) => ({
        bracketId: `R${r}M${i}`,
        player1Id: null, player2Id: null,
        winnerId: null, loserId: null, matchId: null, tiebreakResult: null,
      }));
      rounds.push({ roundNumber: r, phase: phaseForRound(totalRounds, r), matches });
    }

    // Disputa de 3º lugar apenas com 8+ jogadores (4 jogadores → sem 3º)
    const thirdPlaceMatch: BracketMatch | null = players.length > 4
      ? { bracketId: 'THIRD', player1Id: null, player2Id: null, winnerId: null, loserId: null, matchId: null, tiebreakResult: null }
      : null;

    return { totalRounds, rounds, thirdPlaceMatch };
  }

  private async createRoundMatches(
    tournament: Tournament,
    bracket: TournamentBracket,
    roundNumber: number,
  ) {
    const round = bracket.rounds.find(r => r.roundNumber === roundNumber);
    if (!round) return;

    for (const bm of round.matches) {
      if (!bm.player1Id || !bm.player2Id) continue;

      const match = await this.matchesSvc.createMatch(bm.player1Id, bm.player2Id);
      bm.matchId = match.id;

      // Load player data for rich match_found payload
      const [p1, p2] = await Promise.all([
        this.users.findOne({ where: { id: bm.player1Id }, select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
        this.users.findOne({ where: { id: bm.player2Id }, select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
      ]);

      await this.tournamentMatches.save(
        this.tournamentMatches.create({
          tournamentId: tournament.id, matchId: match.id,
          phase: round.phase as TournamentPhase, roundNumber,
          bracketId: bm.bracketId,
          timeControl: tournament.timeControl,
          whitePrize: 0, blackPrize: 0,
        }),
      );

      this.emitMatchFound(bm.player1Id, bm.player2Id, match.id, { ...match, whitePlayer: p1, blackPlayer: p2 });
    }

    // Persiste bracket atualizado com matchIds
    await this.tournaments.update(tournament.id, { bracketData: bracket });
    this.emitBracketUpdate(tournament.id, bracket);
  }

  // ─── Conclusão de partidas ───────────────────────────────────────────────

  async onMatchFinished(
    matchId: string,
    result: MatchResult,
    clockWhiteMs: number,
    clockBlackMs: number,
    moveTimestamps: MoveTimestamp[],
    finalFen?: string,
  ) {
    const tm = await this.tournamentMatches.findOne({
      where: { matchId },
      relations: ['tournament', 'match'],
    });
    if (!tm) return;

    await this.tournamentMatches.update(tm.id, { clockWhiteMs, clockBlackMs, moveTimestamps });

    const { tournament, match } = tm;

    if (tournament.type === TournamentType.DUEL_FLASH || tournament.type === TournamentType.DUEL_GIANT) {
      await this.finalizeDuel(tournament, tm, result, match);
      return;
    }

    if (tournament.type === TournamentType.USER_CREATED) {
      await this.finalizeCustomTournamentMatch(tournament, tm, result, match, clockWhiteMs, clockBlackMs, finalFen);
    }
  }

  private async finalizeDuel(
    tournament: Tournament,
    tm: TournamentMatch,
    result: MatchResult,
    match: Match,
  ) {
    const pool      = tournament.prizePoolCc;
    const whiteWins = this.isWhiteWin(result);
    const blackWins = this.isBlackWin(result);

    if (result === MatchResult.DRAW) {
      const half = Math.floor(pool / 2);
      await this.wallet.credit(match.whitePlayerId, half, TransactionType.PRIZE, tournament.id, 'Empate — metade do pote');
      await this.wallet.credit(match.blackPlayerId!, half, TransactionType.PRIZE, tournament.id, 'Empate — metade do pote');
      await this.tournamentMatches.update(tm.id, { whitePrize: half, blackPrize: half });
    } else {
      const winnerId = whiteWins ? match.whitePlayerId : match.blackPlayerId!;
      await this.wallet.credit(winnerId, pool, TransactionType.PRIZE, tournament.id, `Prêmio duelo`);
      if (whiteWins) await this.tournamentMatches.update(tm.id, { whitePrize: pool });
      else           await this.tournamentMatches.update(tm.id, { blackPrize: pool });
    }

    this.platformRevenue.record(
      PlatformRevenueType.RAKE_DUEL,
      tournament.rakeCc,
      tournament.id,
      `Rake duelo ${tournament.type} — ${tournament.entryFeeCc} CC cada`,
    );

    await this.tournaments.update(tournament.id, {
      status: TournamentStatus.FINISHED,
      finishedAt: new Date(),
      championId: whiteWins ? match.whitePlayerId : blackWins ? match.blackPlayerId! : undefined,
    });
  }

  private async finalizeCustomTournamentMatch(
    tournament: Tournament,
    tm: TournamentMatch,
    result: MatchResult,
    match: Match,
    clockWhiteMs: number,
    clockBlackMs: number,
    finalFen?: string,
  ) {
    const bracket = tournament.bracketData;
    if (!bracket) return;

    let winnerId: string | null = null;
    let loserId:  string | null = null;
    let tiebreakResult: TiebreakResult | null = null;

    if (result === MatchResult.DRAW) {
      // Desempate por material
      const whiteMaterial = finalFen ? materialScore(finalFen, 'w') : 0;
      const blackMaterial = finalFen ? materialScore(finalFen, 'b') : 0;

      if (whiteMaterial > blackMaterial) {
        winnerId = match.whitePlayerId;
        loserId  = match.blackPlayerId!;
        tiebreakResult = 'MATERIAL_WIN';
      } else if (blackMaterial > whiteMaterial) {
        winnerId = match.blackPlayerId!;
        loserId  = match.whitePlayerId;
        tiebreakResult = 'MATERIAL_WIN';
      } else {
        // Material igual → desempate por relógio
        if (clockWhiteMs > clockBlackMs) {
          winnerId = match.whitePlayerId;
          loserId  = match.blackPlayerId!;
          tiebreakResult = 'CLOCK_WIN';
        } else if (clockBlackMs > clockWhiteMs) {
          winnerId = match.blackPlayerId!;
          loserId  = match.whitePlayerId;
          tiebreakResult = 'CLOCK_WIN';
        } else {
          // Dupla eliminação (caso extremamente raro)
          tiebreakResult = 'DOUBLE_ELIMINATION';
        }
      }
    } else {
      winnerId = this.isWhiteWin(result) ? match.whitePlayerId : match.blackPlayerId!;
      loserId  = this.isWhiteWin(result) ? match.blackPlayerId! : match.whitePlayerId;
    }

    await this.tournamentMatches.update(tm.id, { tiebreakResult });

    // Atualiza participantes
    if (tiebreakResult === 'DOUBLE_ELIMINATION') {
      await this.participants.update(
        { tournamentId: tournament.id, userId: match.whitePlayerId },
        { status: ParticipantStatus.ELIMINATED },
      );
      await this.participants.update(
        { tournamentId: tournament.id, userId: match.blackPlayerId! },
        { status: ParticipantStatus.ELIMINATED },
      );
    } else if (loserId) {
      await this.participants.update(
        { tournamentId: tournament.id, userId: loserId },
        { status: ParticipantStatus.ELIMINATED },
      );
    }

    // Atualiza bracket
    const updatedBracket = this.advanceBracket(bracket, tm.bracketId!, winnerId, loserId, tiebreakResult);
    await this.tournaments.update(tournament.id, { bracketData: updatedBracket });
    this.emitBracketUpdate(tournament.id, updatedBracket);

    // Se foi a final ou o 3º lugar, verifica se o torneio pode ser finalizado
    if (tm.phase === TournamentPhase.FINAL || tm.phase === TournamentPhase.THIRD_PLACE) {
      setTimeout(() => {
        this.checkAndFinalizeTournament(tournament.id).catch(e => this.logger.error('finalize', e));
      }, 2_000);
      return;
    }

    // Emite countdown e agenda próxima rodada após 30s
    if (this.nextRoundEmitter) this.nextRoundEmitter(tournament.id, NEXT_MATCH_DELAY_MS / 1000);
    setTimeout(() => {
      this.tryAdvanceRound(tournament.id).catch(e => this.logger.error('advanceRound', e));
    }, NEXT_MATCH_DELAY_MS);
  }

  private advanceBracket(
    bracket: TournamentBracket,
    completedBracketId: string,
    winnerId: string | null,
    loserId: string | null,
    tiebreakResult: TiebreakResult | null,
  ): TournamentBracket {
    const updated = JSON.parse(JSON.stringify(bracket)) as TournamentBracket;

    // Encontra a partida concluída e atualiza
    for (const round of updated.rounds) {
      const match = round.matches.find(m => m.bracketId === completedBracketId);
      if (!match) continue;
      match.winnerId = winnerId;
      match.loserId  = loserId;
      match.tiebreakResult = tiebreakResult;

      // Avança vencedor para próxima rodada
      if (winnerId) {
        const nextRound = updated.rounds.find(r => r.roundNumber === round.roundNumber + 1);
        if (nextRound) {
          const matchIdx   = round.matches.indexOf(match);
          const nextSlot   = Math.floor(matchIdx / 2);
          const isPlayer1  = matchIdx % 2 === 0;
          const nextMatch  = nextRound.matches[nextSlot];
          if (nextMatch) {
            if (isPlayer1) nextMatch.player1Id = winnerId;
            else           nextMatch.player2Id = winnerId;
          }
        }

        // Perdedores das semis → disputa de 3º lugar
        if (round.phase === TournamentPhase.SEMIFINAL && loserId && updated.thirdPlaceMatch) {
          if (!updated.thirdPlaceMatch.player1Id) updated.thirdPlaceMatch.player1Id = loserId;
          else                                    updated.thirdPlaceMatch.player2Id = loserId;
        }
      }
      break;
    }

    // Verifica 3º lugar
    if (updated.thirdPlaceMatch?.bracketId === completedBracketId) {
      const m = updated.thirdPlaceMatch;
      m.winnerId = winnerId;
      m.loserId  = loserId;
      m.tiebreakResult = tiebreakResult;
    }

    return updated;
  }

  private async tryAdvanceRound(tournamentId: string) {
    const tournament = await this.tournaments.findOne({ where: { id: tournamentId } });
    if (!tournament?.bracketData || tournament.status !== TournamentStatus.IN_PROGRESS) return;

    const bracket = tournament.bracketData;

    // Find the current active round: highest-numbered round with any match started (matchId set).
    // This fixes the bug where the loop exits at round 1 (already done) without ever reaching
    // the actual in-progress round (e.g. round 2 semis in an 8-player tournament).
    let currentRound = bracket.rounds[0];
    for (const round of bracket.rounds) {
      if (round.matches.some(m => m.matchId !== null)) {
        currentRound = round;
      }
    }

    const pendingMatches = currentRound.matches.filter(
      m => m.player1Id && m.player2Id && !m.winnerId && m.tiebreakResult !== 'DOUBLE_ELIMINATION',
    );
    if (pendingMatches.length > 0) return; // round still in progress

    const allDone = currentRound.matches.every(
      m => m.winnerId !== null || m.tiebreakResult === 'DOUBLE_ELIMINATION' || (!m.player1Id && !m.player2Id),
    );
    if (!allDone) return;

    const nextRound = bracket.rounds.find(r => r.roundNumber === currentRound.roundNumber + 1);
    if (nextRound) {
      const readyMatches = nextRound.matches.filter(m => m.player1Id && m.player2Id && !m.matchId);
      if (readyMatches.length > 0) {
        await this.createRoundMatches(tournament, bracket, nextRound.roundNumber);
      }
      // When advancing to the final, also create 3rd place match (both semi losers are now known)
      if (nextRound.phase === TournamentPhase.FINAL && bracket.thirdPlaceMatch?.player1Id && bracket.thirdPlaceMatch?.player2Id && !bracket.thirdPlaceMatch.matchId) {
        await this.createThirdPlaceMatch(tournament, bracket);
      }
    }
    // No else branch needed: the final round itself triggers checkAndFinalizeTournament via
    // finalizeCustomTournamentMatch when phase === FINAL.
  }

  private async createThirdPlaceMatch(tournament: Tournament, bracket: TournamentBracket) {
    const third = bracket.thirdPlaceMatch;
    if (!third || !third.player1Id || !third.player2Id || third.matchId) return;

    const match = await this.matchesSvc.createMatch(third.player1Id, third.player2Id);
    third.matchId = match.id;

    const [p1, p2] = await Promise.all([
      this.users.findOne({ where: { id: third.player1Id }, select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
      this.users.findOne({ where: { id: third.player2Id }, select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
    ]);

    await this.tournamentMatches.save(
      this.tournamentMatches.create({
        tournamentId: tournament.id, matchId: match.id,
        phase: TournamentPhase.THIRD_PLACE, roundNumber: bracket.totalRounds,
        bracketId: 'THIRD', timeControl: tournament.timeControl,
        whitePrize: 0, blackPrize: 0,
      }),
    );

    this.emitMatchFound(third.player1Id, third.player2Id, match.id, { ...match, whitePlayer: p1, blackPlayer: p2 });

    await this.tournaments.update(tournament.id, { bracketData: bracket });
    this.emitBracketUpdate(tournament.id, bracket);
  }

  private async createFinalAndThirdPlace(tournament: Tournament, bracket: TournamentBracket) {
    const finalRound = bracket.rounds[bracket.rounds.length - 1];
    const finalMatch = finalRound?.matches[0];

    if (finalMatch?.player1Id && finalMatch?.player2Id && !finalMatch.matchId) {
      const match = await this.matchesSvc.createMatch(finalMatch.player1Id, finalMatch.player2Id);
      finalMatch.matchId = match.id;

      const [p1, p2] = await Promise.all([
        this.users.findOne({ where: { id: finalMatch.player1Id }, select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
        this.users.findOne({ where: { id: finalMatch.player2Id }, select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
      ]);

      await this.tournamentMatches.save(
        this.tournamentMatches.create({
          tournamentId: tournament.id, matchId: match.id,
          phase: TournamentPhase.FINAL, roundNumber: bracket.totalRounds,
          bracketId: finalMatch.bracketId, timeControl: tournament.timeControl,
          whitePrize: 0, blackPrize: 0,
        }),
      );
      this.emitMatchFound(finalMatch.player1Id, finalMatch.player2Id, match.id, { ...match, whitePlayer: p1, blackPlayer: p2 });
    }

    await this.createThirdPlaceMatch(tournament, bracket);

    await this.tournaments.update(tournament.id, { bracketData: bracket });
    this.emitBracketUpdate(tournament.id, bracket);
  }

  // ─── Distribuição de prêmios com SLA de IA ───────────────────────────────

  private async checkAndFinalizeTournament(tournamentId: string) {
    const tournament = await this.tournaments.findOne({ where: { id: tournamentId } });
    if (!tournament?.bracketData) return;
    // Guard against double-finalization (FINAL and THIRD_PLACE both call this)
    if (tournament.status !== TournamentStatus.IN_PROGRESS) return;

    const bracket = tournament.bracketData;
    const finalRound = bracket.rounds[bracket.rounds.length - 1];
    const finalDone = finalRound?.matches[0]?.winnerId != null
      || finalRound?.matches[0]?.tiebreakResult === 'DOUBLE_ELIMINATION';
    // Se não há disputa de 3º (torneio de 4 jogadores), considera concluído
    const thirdDone = !bracket.thirdPlaceMatch
      || bracket.thirdPlaceMatch.winnerId != null
      || bracket.thirdPlaceMatch.tiebreakResult === 'DOUBLE_ELIMINATION';

    if (!finalDone || !thirdDone) return;

    const champion  = finalRound.matches[0].winnerId;
    const second    = finalRound.matches[0].loserId;
    const third     = bracket.thirdPlaceMatch?.winnerId ?? null;

    await this.tournaments.update(tournamentId, {
      championId: champion, secondPlaceId: second, thirdPlaceId: third,
      finishedAt: new Date(), aiFraudStatus: 'PENDING',
    });

    await this.participants.update({ tournamentId, userId: champion! }, { status: ParticipantStatus.CHAMPION });
    if (second) await this.participants.update({ tournamentId, userId: second }, { status: ParticipantStatus.SECOND });
    if (third)  await this.participants.update({ tournamentId, userId: third  }, { status: ParticipantStatus.THIRD });

    // Dispara análise IA com SLA de 60min
    this.runFraudAnalysisWithTimeout(tournament).catch(e =>
      this.logger.error('fraud analysis', e),
    );
  }

  private async runFraudAnalysisWithTimeout(tournament: Tournament) {
    let resolved = false;

    const timeoutHandle = setTimeout(async () => {
      if (resolved) return;
      resolved = true;
      this.logger.warn(`AI fraud analysis timeout for tournament ${tournament.id} — auto-releasing prizes`);
      await this.tournaments.update(tournament.id, { aiFraudStatus: 'TIMEOUT' });
      await this.distributeTournamentPrizes(tournament.id, 'timeout');
    }, AI_FRAUD_TIMEOUT_MS);

    try {
      const tms = await this.tournamentMatches.find({
        where: { tournamentId: tournament.id, phase: TournamentPhase.FINAL },
        relations: ['match'],
      });

      const userPrompt = `
        Torneio: "${tournament.name}" (ID: ${tournament.id}).
        Partidas da final: ${JSON.stringify(tms.map(tm => ({
          moveTimestamps: tm.moveTimestamps.slice(0, 20),
          clockWhiteMs: tm.clockWhiteMs,
          clockBlackMs: tm.clockBlackMs,
        })))}.
        Verifique padrões suspeitos: lances < 2s consistentes, precisão ≥ 95%,
        discrepância ELO vs qualidade.
      `;

      const aiResult = await this.deepseek.analyze<{ verdict: string; reason: string }>(
        AiFeature.TOURNAMENT_FRAUD_CHECK,
        'Você é um sistema antifraude de xadrez. Responda apenas JSON: { "verdict": "CLEAN"|"SUSPICIOUS"|"CHEATING", "reason": "..." }',
        userPrompt,
        tournament.id,
        300,
      );

      const response = JSON.stringify(aiResult ?? { verdict: 'CLEAN', reason: 'IA indisponível' });

      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutHandle);

      const verdict = this.parseAiFraudVerdict(response);

      if (verdict === 'CHEATING') {
        await this.tournaments.update(tournament.id, { aiFraudStatus: 'FLAGGED' });
        // Notifica vencedores que prêmio está em revisão
        const t = await this.tournaments.findOne({ where: { id: tournament.id } });
        if (t?.championId)  await this.notifications.create(t.championId,  NotificationType.TOURNAMENT_PRIZE_FLAGGED, { tournamentId: tournament.id });
        if (t?.secondPlaceId) await this.notifications.create(t.secondPlaceId, NotificationType.TOURNAMENT_PRIZE_FLAGGED, { tournamentId: tournament.id });
        if (t?.thirdPlaceId)  await this.notifications.create(t.thirdPlaceId,  NotificationType.TOURNAMENT_PRIZE_FLAGGED, { tournamentId: tournament.id });
      } else {
        await this.tournaments.update(tournament.id, { aiFraudStatus: 'APPROVED' });
        await this.distributeTournamentPrizes(tournament.id, 'approved');
      }
    } catch (err) {
      if (resolved) return;
      this.logger.error(`AI fraud error for ${tournament.id}`, err);
      // 2 retentativas já implícitas no caller; após falha deixa timeout agir
    }
  }

  private parseAiFraudVerdict(response: string): 'CLEAN' | 'SUSPICIOUS' | 'CHEATING' {
    try {
      const parsed = JSON.parse(response) as { verdict?: string };
      if (['CLEAN', 'SUSPICIOUS', 'CHEATING'].includes(parsed.verdict ?? '')) {
        return parsed.verdict as 'CLEAN' | 'SUSPICIOUS' | 'CHEATING';
      }
    } catch { /* fallback */ }
    return 'CLEAN';
  }

  private async distributeTournamentPrizes(tournamentId: string, reason: string) {
    const tournament = await this.tournaments.findOne({ where: { id: tournamentId } });
    if (!tournament) return;

    const prizes = calcPrizes(tournament.maxPlayers, tournament.entryFeeCc);

    const awards: Array<{ userId: string | null; amount: number; position: string }> = [
      { userId: tournament.championId,    amount: prizes.first,  position: '1º lugar' },
      { userId: tournament.secondPlaceId, amount: prizes.second, position: '2º lugar' },
      { userId: tournament.thirdPlaceId,  amount: prizes.third,  position: '3º lugar' },
    ];

    for (const { userId, amount, position } of awards) {
      if (!userId || amount <= 0) continue;
      await this.wallet.credit(
        userId, amount, TransactionType.PRIZE,
        tournamentId, `Prêmio ${position} — ${tournament.name}`,
      );
      await this.participants.update(
        { tournamentId, userId },
        { prizeWon: amount },
      );
      await this.notifications.create(userId, NotificationType.TOURNAMENT_PRIZE_RELEASED, {
        tournamentId, tournamentName: tournament.name,
        amount, position, reason,
      });
    }

    await this.tournaments.update(tournamentId, { status: TournamentStatus.FINISHED });

    const t = await this.tournaments.findOne({ where: { id: tournamentId } });
    if (t && t.rakeCc > 0) {
      this.platformRevenue.record(
        PlatformRevenueType.RAKE_TOURNAMENT,
        t.rakeCc,
        tournamentId,
        `Rake torneio "${t.name}" (${t.maxPlayers} jogadores)`,
      );
    }

    // Notifica sala do torneio em tempo real
    if (this.tournamentFinishedEmitter) {
      const updated = await this.getTournamentDetails(tournamentId).catch(() => null);
      this.tournamentFinishedEmitter(tournamentId, updated);
    }
  }

  // ─── Listagem de torneios ────────────────────────────────────────────────

  async listTournaments(dto: ListTournamentsDto, requestingUserId?: string) {
    const page  = dto.page  ?? 1;
    const limit = Math.min(dto.limit ?? 20, 50);
    const skip  = (page - 1) * limit;

    const qb = this.tournaments.createQueryBuilder('t')
      .leftJoinAndSelect('t.participants', 'p')
      .where('t.type = :type', { type: TournamentType.USER_CREATED });

    if (dto.name) {
      qb.andWhere('t.name ILIKE :name', { name: `%${dto.name}%` });
    }
    if (dto.status) {
      qb.andWhere('t.status = :status', { status: dto.status });
    }
    if (dto.isPublic === true) {
      qb.andWhere('t.isPrivate = false');
    } else if (dto.isPublic === false) {
      qb.andWhere('t.isPrivate = true');
    }

    const sortMap: Record<TournamentSortField, string> = {
      [TournamentSortField.CREATED_AT]: 't.createdAt',
      [TournamentSortField.PLAYERS]:    't.maxPlayers',
      [TournamentSortField.ENTRY_FEE]:  't.entryFeeCc',
      [TournamentSortField.PRIZE_POOL]: 't.prizePoolCc',
    };
    const sortField = sortMap[dto.sortBy ?? TournamentSortField.CREATED_AT];
    const sortOrder = dto.sortOrder ?? SortOrder.DESC;
    qb.orderBy(sortField, sortOrder).skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(t => this.tournamentListView(t, requestingUserId)),
      total, page, totalPages: Math.ceil(total / limit),
    };
  }

  async getUserTournaments(userId: string, dto: ListTournamentsDto) {
    const page  = dto.page  ?? 1;
    const limit = Math.min(dto.limit ?? 20, 50);
    const skip  = (page - 1) * limit;

    const qb = this.tournaments.createQueryBuilder('t')
      .innerJoin('t.participants', 'p', 'p.userId = :uid', { uid: userId })
      .leftJoinAndSelect('t.participants', 'allP')
      .where('t.type = :type', { type: TournamentType.USER_CREATED })
      .orderBy('t.createdAt', 'DESC')
      .skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(t => this.tournamentListView(t, userId)), total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Detalhes ────────────────────────────────────────────────────────────

  async getTournamentDetails(tournamentId: string) {
    const t = await this.tournaments.findOne({
      where: { id: tournamentId },
      relations: ['participants', 'participants.user', 'tournamentMatches', 'tournamentMatches.match'],
    });
    if (!t) throw new NotFoundException('Torneio não encontrado');
    return {
      ...t,
      participants: (t.participants ?? []).map(p => ({
        userId: p.userId,
        nickname: p.user?.nickname ?? p.userId,
        avatarUrl: (p.user as any)?.avatarUrl ?? null,
        rating: (p.user as any)?.rating ?? null,
        status: p.status,
        hasEntryDebited: p.hasEntryDebited,
        invitedByCreator: p.invitedByCreator,
        bracketPosition: p.bracketPosition,
        prizeWon: p.prizeWon,
      })),
    };
  }

  async getMatchTournamentDetails(matchId: string) {
    return this.tournamentMatches.findOne({
      where: { matchId },
      relations: ['tournament', 'match', 'match.whitePlayer', 'match.blackPlayer'],
    });
  }

  async getUserTournamentHistory(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.tournamentMatches
      .createQueryBuilder('tm')
      .innerJoin('tm.match', 'm')
      .where('m.white_player_id = :uid OR m.black_player_id = :uid', { uid: userId })
      .leftJoinAndSelect('tm.tournament', 'tournament')
      .leftJoinAndSelect('tm.match', 'match')
      .leftJoinAndSelect('match.whitePlayer', 'whitePlayer')
      .leftJoinAndSelect('match.blackPlayer', 'blackPlayer')
      .orderBy('tm.createdAt', 'DESC')
      .skip((page - 1) * limit).take(limit)
      .getManyAndCount();
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Stagnation cleanup ──────────────────────────────────────────────────

  private async runStagnationCleanup() {
    const cutoff48h = new Date(Date.now() - STAGNATION_KILL_MS);
    const staleTournaments = await this.tournaments.find({
      where: {
        status: TournamentStatus.REGISTERING,
        type: TournamentType.USER_CREATED,
        createdAt: MoreThan(new Date(0)), // all
      },
    });

    for (const t of staleTournaments) {
      if (t.createdAt < cutoff48h) {
        // Cancel automático
        await this.tournaments.update(t.id, { status: TournamentStatus.CANCELLED });
        const parts = await this.participants.find({ where: { tournamentId: t.id } });
        await Promise.all(parts.map(p =>
          this.notifications.create(p.userId, NotificationType.TOURNAMENT_CANCELLED, {
            tournamentId: t.id,
            tournamentName: t.name,
            reason: 'Torneio cancelado automaticamente por inatividade (48h sem completar vagas)',
          }),
        ));
        this.logger.log(`Auto-cancelled stagnant tournament ${t.id}`);
      } else if (t.createdAt < new Date(Date.now() - STAGNATION_WARN_MS)) {
        // Notifica criador após 24h sem atividade (apenas uma vez — heurística simples)
        if (t.creatorId) {
          await this.notifications.create(t.creatorId, NotificationType.ADMIN_MESSAGE, {
            message: `Seu torneio "${t.name}" está sem novos jogadores há mais de 24h. Considere cancelá-lo ou compartilhá-lo com amigos.`,
            tournamentId: t.id,
          });
        }
      }
    }
  }

  // ─── Helpers de view ─────────────────────────────────────────────────────

  private tournamentListView(t: Tournament, requestingUserId?: string) {
    const activePlayers = (t.participants ?? []).filter(
      p => p.status !== ParticipantStatus.KICKED,
    ).length;
    const prizes = calcPrizes(t.maxPlayers, t.entryFeeCc);
    return {
      id: t.id,
      name: t.name,
      creatorId: t.creatorId,
      status: t.status,
      entryFeeCc: t.entryFeeCc,
      maxPlayers: t.maxPlayers,
      currentPlayers: activePlayers,
      timeControl: t.timeControl,
      isPrivate: t.isPrivate,
      isFlexible: t.isFlexible,
      prizePool: prizes.prizePool,
      prizes: { first: prizes.first, second: prizes.second, third: prizes.third },
      isUserJoined: requestingUserId
        ? (t.participants ?? []).some(p => p.userId === requestingUserId && p.status !== ParticipantStatus.KICKED)
        : undefined,
      createdAt: t.createdAt,
    };
  }

  private tournamentPublicView(t: Tournament) {
    const prizes = calcPrizes(t.maxPlayers, t.entryFeeCc);
    return {
      id: t.id, name: t.name, status: t.status,
      entryFeeCc: t.entryFeeCc, creationFeeCc: t.creationFeeCc,
      maxPlayers: t.maxPlayers, timeControl: t.timeControl,
      isPrivate: t.isPrivate, isFlexible: t.isFlexible,
      prizes: { first: prizes.first, second: prizes.second, third: prizes.third },
      createdAt: t.createdAt,
    };
  }

  // ─── WebSocket helpers ───────────────────────────────────────────────────

  private emitBracketUpdate(tournamentId: string, bracket: TournamentBracket) {
    if (this.bracketUpdateEmitter) {
      this.bracketUpdateEmitter(tournamentId, bracket);
    }
  }

  private emitMatchFound(player1Id: string, player2Id: string, matchId: string, match: any) {
    if (this.matchFoundEmitter) {
      this.matchFoundEmitter(player1Id, player2Id, matchId, match);
    }
  }

  private emitTournamentRoomUpdate(tournamentId: string, data: object) {
    // Implementado pelo TournamentGateway via injeção do callback
    if ((this as any)._roomUpdateEmitter) {
      (this as any)._roomUpdateEmitter(tournamentId, data);
    }
  }

  private async getParticipantsList(tournamentId: string) {
    const parts = await this.participants.find({
      where: { tournamentId },
      relations: ['user'],
      order: { createdAt: 'ASC' } as any,
    });
    return parts.map(p => ({
      userId: p.userId,
      nickname: (p.user as any)?.nickname ?? p.userId,
      avatarUrl: (p.user as any)?.avatarUrl ?? null,
      rating: (p.user as any)?.rating ?? null,
      status: p.status,
      hasEntryDebited: p.hasEntryDebited,
      bracketPosition: p.bracketPosition ?? null,
    }));
  }

  private async emitRoomUpdateWithParticipants(tournamentId: string, type: string, extraData: object = {}) {
    const participants = await this.getParticipantsList(tournamentId);
    this.emitTournamentRoomUpdate(tournamentId, { type, participants, ...extraData });
  }

  private async notifyParticipantsAlmostFull(tournament: Tournament, count: number) {
    const parts = await this.participants.find({ where: { tournamentId: tournament.id } });
    await Promise.all(parts.map(p =>
      this.notifications.create(p.userId, NotificationType.TOURNAMENT_ALMOST_FULL, {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        currentPlayers: count,
        maxPlayers: tournament.maxPlayers,
      }),
    ));
  }

  // ─── Utils ───────────────────────────────────────────────────────────────

  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  private isWhiteWin(result: MatchResult): boolean {
    return ['WHITE_WINS', 'FORFEIT_BLACK', 'TIMEOUT_BLACK'].includes(result as string);
  }

  private isBlackWin(result: MatchResult): boolean {
    return ['BLACK_WINS', 'FORFEIT_WHITE', 'TIMEOUT_WHITE'].includes(result as string);
  }
}
