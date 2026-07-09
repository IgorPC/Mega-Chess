import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchesService } from '../matches/matches.service';
import { GameGateway } from '../game/game.gateway';
import { User } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../entities/notification.entity';
import {
  Tournament, TournamentType, TournamentStatus,
  DUEL_CONFIG, DuelEntryFee, RAKE_RATE,
} from '../entities/tournament.entity';
import { TournamentParticipant, ParticipantStatus } from '../entities/tournament-participant.entity';
import { TournamentMatch, TournamentPhase } from '../entities/tournament-match.entity';
import { WalletService } from '../wallet/wallet.service';
import { TransactionType } from '../entities/wallet-transaction.entity';
import { UserActivityService } from '../user-activity/user-activity.service';
import { UserAction } from '../entities/user-activity-log.entity';
import { BotService } from '../bots/bot.service';
import { calculateAge, MINIMUM_DUEL_AGE } from '../common/age.util';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

interface QueueEntry {
  userId: string;
  rating: number;
  joinedAt: Date;
  isBot?: boolean;
}

const BOT_WAIT_MS = 15_000;
const BOT_INJECT_INTERVAL_MS = 3_000;
// Virtual bot slots always visible in queue size (makes queue look active)
const BOT_VIRTUAL_SLOTS = 3;

@Injectable()
export class MatchmakingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchmakingService.name);

  private casualQueue: QueueEntry[] = [];

  private duelQueues = new Map<string, QueueEntry[]>();
  private userDuelQueueKey = new Map<string, string>();

  // Bot state
  private botUsers: User[] = [];
  private botInjectTimer: NodeJS.Timeout | null = null;

  constructor(
    private matches: MatchesService,
    private game: GameGateway,
    private wallet: WalletService,
    private notifications: NotificationsService,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Tournament) private tournaments: Repository<Tournament>,
    @InjectRepository(TournamentParticipant) private participants: Repository<TournamentParticipant>,
    @InjectRepository(TournamentMatch) private tournamentMatches: Repository<TournamentMatch>,
    private activity: UserActivityService,
    private botService: BotService,
  ) {}

  async onModuleInit() {
    await this.seedBotsIfNeeded();
    await this.loadBots();
    this.botInjectTimer = setInterval(() => this.injectBotsForWaiters(), BOT_INJECT_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.botInjectTimer) clearInterval(this.botInjectTimer);
  }

  private async loadBots() {
    this.botUsers = await this.users.find({ where: { isBot: true } });
    this.logger.log(`[bots] Loaded ${this.botUsers.length} bot accounts`);
  }

  private async seedBotsIfNeeded() {
    const count = await this.users.count({ where: { isBot: true } });
    if (count > 0) return;

    this.logger.log('[bots] No bots found — seeding 10 bot accounts');
    const BOTS: { nickname: string; name: string; rating: number; difficulty: 'EASY'|'MEDIUM'|'HARD' }[] = [
      { nickname: 'MagoBranco',       name: 'Mago Branco',       rating: 600,  difficulty: 'EASY'   },
      { nickname: 'PeaoQuente',       name: 'Peão Quente',       rating: 700,  difficulty: 'EASY'   },
      { nickname: 'TorreDoSul',       name: 'Torre do Sul',      rating: 750,  difficulty: 'EASY'   },
      { nickname: 'CavaleiroCaipira', name: 'Cavaleiro Caipira', rating: 800,  difficulty: 'EASY'   },
      { nickname: 'GandalfNegro',     name: 'Gandalf Negro',     rating: 900,  difficulty: 'MEDIUM' },
      { nickname: 'GryffinDama',      name: 'Gryffin Dama',      rating: 1000, difficulty: 'MEDIUM' },
      { nickname: 'MerlinXadrez',     name: 'Merlin Xadrez',     rating: 1050, difficulty: 'MEDIUM' },
      { nickname: 'SauronRei',        name: 'Sauron Rei',        rating: 1100, difficulty: 'MEDIUM' },
      { nickname: 'MagnusFischer',     name: 'Magnus Fischer',    rating: 1200, difficulty: 'HARD'   },
      { nickname: 'LordKasparov',     name: 'Lord Kasparov',     rating: 1400, difficulty: 'HARD'   },
    ];

    for (const bot of BOTS) {
      try {
        const unusableHash = await bcrypt.hash(uuidv4(), 10);
        await this.users.save(this.users.create({
          email: `bot-${bot.nickname.toLowerCase()}@megachess.internal`,
          name: bot.name,
          nickname: bot.nickname,
          passwordHash: unusableHash,
          rating: bot.rating,
          isBot: true,
          botDifficulty: bot.difficulty,
          emailVerified: true,
          isOnline: false,
        }));
        this.logger.log(`[bots] Seeded: ${bot.nickname}`);
      } catch (err) {
        this.logger.warn(`[bots] Could not seed ${bot.nickname}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  private getAvailableBots(): User[] {
    return this.botUsers.filter(b => !this.botService.isActive(b.id));
  }

  private injectBotsForWaiters() {
    const now = Date.now();
    const longWaiters = this.casualQueue.filter(
      e => !e.isBot && (now - e.joinedAt.getTime()) > BOT_WAIT_MS,
    );
    if (!longWaiters.length) return;

    const available = this.getAvailableBots();
    if (!available.length) return;

    for (const waiter of longWaiters) {
      if (!this.casualQueue.find(e => e.userId === waiter.userId)) continue; // already matched

      const bot = [...available].sort(
        (a, b) => Math.abs(a.rating - waiter.rating) - Math.abs(b.rating - waiter.rating),
      )[0];
      if (!bot) break;

      this.logger.log(`[bots] Injecting bot ${bot.nickname} (ELO ${bot.rating}) for waiter ${waiter.userId}`);
      this.casualQueue = this.casualQueue.filter(e => e.userId !== waiter.userId);
      this.botService.markBotActive(bot.id);
      this.startCasualMatch(waiter.userId, bot.id).catch((err) => {
        this.logger.error(`[bots] startCasualMatch failed: ${err}`);
        this.botService.markBotIdle(bot.id);
      });
    }
  }

  // --- Casual ---

  async joinQueue(userId: string) {
    if (this.casualQueue.find(e => e.userId === userId)) {
      return { status: 'already_queued' };
    }

    const user = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'rating'],
    });
    if (!user) throw new NotFoundException('User not found');

    // Try to match with a human first
    const humanOpponent = this.findBestOpponent(
      this.casualQueue.filter(e => !e.isBot),
      user.rating,
    );
    if (humanOpponent) {
      this.casualQueue = this.casualQueue.filter(e => e.userId !== humanOpponent.userId);
      return this.startCasualMatch(userId, humanOpponent.userId);
    }

    this.casualQueue.push({ userId, rating: user.rating, joinedAt: new Date() });
    this.activity.log(userId, UserAction.MATCHMAKING_JOINED, { queue: 'casual' });
    return { status: 'queued' };
  }

  leaveQueue(userId: string) {
    const before = this.casualQueue.length;
    this.casualQueue = this.casualQueue.filter(e => e.userId !== userId);
    if (this.casualQueue.length < before) {
      this.activity.log(userId, UserAction.MATCHMAKING_LEFT, { queue: 'casual' });
    }
    return { status: this.casualQueue.length < before ? 'left' : 'not_in_queue' };
  }

  private async startCasualMatch(userId1: string, userId2: string) {
    const white = Math.random() > 0.5 ? userId1 : userId2;
    const black = white === userId1 ? userId2 : userId1;

    const [match, wp, bp] = await Promise.all([
      this.matches.createMatch(white, black),
      this.users.findOne({ where: { id: white }, select: ['id', 'nickname', 'rating', 'avatarUrl', 'isBot', 'botDifficulty'] }),
      this.users.findOne({ where: { id: black }, select: ['id', 'nickname', 'rating', 'avatarUrl', 'isBot', 'botDifficulty'] }),
    ]);

    const matchPayload = {
      whitePlayer: { id: wp!.id, nickname: wp!.nickname, rating: wp!.rating, avatarUrl: wp!.avatarUrl ?? null, isBot: wp!.isBot },
      blackPlayer: { id: bp!.id, nickname: bp!.nickname, rating: bp!.rating, avatarUrl: bp!.avatarUrl ?? null, isBot: bp!.isBot },
    };

    // Only emit to human players
    if (!wp!.isBot) this.game.emitToUser(white, 'match_found', { matchId: match.id, color: 'white', match: matchPayload });
    if (!bp!.isBot) this.game.emitToUser(black, 'match_found', { matchId: match.id, color: 'black', match: matchPayload });

    return { status: 'matched', matchId: match.id };
  }

  // --- Duel queue ---

  async joinDuelQueue(
    userId: string,
    type: TournamentType.DUEL_FLASH | TournamentType.DUEL_GIANT,
    entryFee: DuelEntryFee,
  ) {
    if (this.userDuelQueueKey.has(userId)) {
      this.logger.debug(`[duel] ${userId} already in queue, rejecting double-join`);
      return { status: 'already_queued' };
    }
    this.userDuelQueueKey.set(userId, '');

    try {
      await this.wallet.assertBalance(userId, entryFee);

      const user = await this.users.findOne({
        where: { id: userId },
        select: ['id', 'rating', 'birthDate'],
      });
      if (!user) throw new NotFoundException('User not found');
      if (!user.birthDate || calculateAge(user.birthDate) < MINIMUM_DUEL_AGE) {
        throw new BadRequestException('É necessário ter ao menos 18 anos e informar sua data de nascimento no perfil para participar de duelos');
      }

      const key = `${type}:${entryFee}`;
      if (!this.duelQueues.has(key)) this.duelQueues.set(key, []);
      const queue = this.duelQueues.get(key)!;

      this.logger.debug(`[duel] ${userId} (${user.rating} ELO) checking queue "${key}" — ${queue.length} waiting`);

      const opponent = this.findBestOpponent(queue, user.rating);
      if (opponent) {
        this.duelQueues.set(key, queue.filter(e => e.userId !== opponent.userId));
        this.userDuelQueueKey.delete(opponent.userId);
        this.userDuelQueueKey.delete(userId);

        this.logger.log(`[duel] Pairing ${userId} vs ${opponent.userId} — key "${key}"`);
        try {
          return await this.startDuelMatch(userId, opponent.userId, type, entryFee);
        } catch (err) {
          this.logger.error(`[duel] startDuelMatch failed for ${userId} vs ${opponent.userId}`, err instanceof Error ? err.stack : err);
          const q = this.duelQueues.get(key) ?? [];
          q.push(opponent);
          this.duelQueues.set(key, q);
          this.userDuelQueueKey.set(opponent.userId, key);
          throw err;
        }
      }

      queue.push({ userId, rating: user.rating, joinedAt: new Date() });
      this.userDuelQueueKey.set(userId, key);
      this.logger.log(`[duel] ${userId} queued at "${key}" — now ${queue.length} waiting`);
      return { status: 'queued' };
    } catch (err) {
      if (this.userDuelQueueKey.get(userId) === '') {
        this.userDuelQueueKey.delete(userId);
      }
      throw err;
    }
  }

  leaveDuelQueue(userId: string) {
    const key = this.userDuelQueueKey.get(userId);
    if (!key || key === '') return { status: 'not_in_queue' };

    const queue = this.duelQueues.get(key) ?? [];
    this.duelQueues.set(key, queue.filter(e => e.userId !== userId));
    this.userDuelQueueKey.delete(userId);
    this.logger.log(`[duel] ${userId} left queue "${key}"`);
    return { status: 'left' };
  }

  private async startDuelMatch(
    userId: string,
    opponentId: string,
    type: TournamentType.DUEL_FLASH | TournamentType.DUEL_GIANT,
    entryFee: DuelEntryFee,
  ) {
    const cfg = DUEL_CONFIG[type];
    const white = Math.random() > 0.5 ? userId : opponentId;
    const black = white === userId ? opponentId : userId;

    const total = entryFee * 2;
    const prizePool = Math.floor(total * (1 - RAKE_RATE));
    const rake = total - prizePool;

    this.logger.debug(`[duel] startDuelMatch white=${white} black=${black} fee=${entryFee}`);

    const tournament = await this.tournaments.save(
      this.tournaments.create({
        type,
        entryFeeCc: entryFee,
        timeControl: cfg.timeControl,
        maxPlayers: 2,
        name: null,
        creatorId: null,
        isPrivate: false,
        isFlexible: false,
        creationFeeCc: 0,
        status: TournamentStatus.IN_PROGRESS,
        prizePoolCc: prizePool,
        rakeCc: rake,
        startedAt: new Date(),
      }),
    );

    await this.wallet.debit(
      white, entryFee, TransactionType.ENTRY_RESERVE,
      tournament.id, `Duelo ${type} — ${entryFee} CC`,
    );

    try {
      await this.wallet.debit(
        black, entryFee, TransactionType.ENTRY_RESERVE,
        tournament.id, `Duelo ${type} — ${entryFee} CC`,
      );
    } catch (err) {
      this.logger.warn(`[duel] black player ${black} debit failed — refunding white and cancelling`);
      await this.wallet.credit(
        white, entryFee, TransactionType.ENTRY_RELEASE,
        tournament.id, 'Oponente sem saldo — CC reembolsados',
      ).catch((e) => {
        this.logger.error(`[duel] Failed to refund white ${white} after black debit failure tournamentId=${tournament.id}`, e instanceof Error ? e.stack : String(e));
      });
      await this.tournaments.update(tournament.id, { status: TournamentStatus.CANCELLED }).catch((e) => {
        this.logger.error(`[duel] Failed to cancel tournament after debit failure tournamentId=${tournament.id}`, e instanceof Error ? e.stack : String(e));
      });
      throw new BadRequestException('Oponente sem saldo suficiente para o duelo');
    }

    await Promise.all([
      this.participants.save(this.participants.create({
        tournamentId: tournament.id, userId: white,
        status: ParticipantStatus.ACTIVE, entryFeePaid: entryFee, hasEntryDebited: true,
      })),
      this.participants.save(this.participants.create({
        tournamentId: tournament.id, userId: black,
        status: ParticipantStatus.ACTIVE, entryFeePaid: entryFee, hasEntryDebited: true,
      })),
    ]);

    const match = await this.matches.createMatch(white, black);
    await this.tournamentMatches.save(
      this.tournamentMatches.create({
        tournamentId: tournament.id, matchId: match.id,
        phase: TournamentPhase.DUEL, roundNumber: 1,
        timeControl: cfg.timeControl,
        whitePrize: 0, blackPrize: 0,
      }),
    );

    const [wp, bp] = await Promise.all([
      this.users.findOne({ where: { id: white }, select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
      this.users.findOne({ where: { id: black }, select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
    ]);

    if (!wp || !bp) {
      this.logger.error(`[duel] Could not load player data: white=${white} wp=${!!wp} black=${black} bp=${!!bp}`);
      throw new Error('Failed to load player data for match_found event');
    }

    const matchPayload = {
      whitePlayer: { id: wp.id, nickname: wp.nickname, rating: wp.rating, avatarUrl: wp.avatarUrl ?? null },
      blackPlayer: { id: bp.id, nickname: bp.nickname, rating: bp.rating, avatarUrl: bp.avatarUrl ?? null },
    };

    this.logger.log(`[duel] Emitting match_found for match ${match.id} — white=${white} black=${black}`);
    this.game.emitToUser(white, 'match_found', { matchId: match.id, color: 'white', match: matchPayload });
    this.game.emitToUser(black, 'match_found', { matchId: match.id, color: 'black', match: matchPayload });

    return { status: 'matched', tournamentId: tournament.id, matchId: match.id };
  }

  // --- Challenges ---

  async sendChallenge(challengerId: string, challengedId: string) {
    const challenger = await this.users.findOne({ where: { id: challengerId } });
    if (!challenger) throw new NotFoundException('User not found');

    this.game.emitToUser(challengedId, 'challenge_received', {
      challengerId,
      challengerNickname: challenger.nickname,
      challengerRating: challenger.rating,
      expiresIn: 60,
    });

    await this.notifications.create(challengedId, NotificationType.GAME_CHALLENGE, {
      challengerId,
      challengerNickname: challenger.nickname,
      challengerRating: challenger.rating,
    });

    return { status: 'sent' };
  }

  async acceptChallenge(acceptorId: string, challengerId: string) {
    const white = Math.random() > 0.5 ? acceptorId : challengerId;
    const black = white === acceptorId ? challengerId : acceptorId;

    const [match, wp, bp] = await Promise.all([
      this.matches.createMatch(white, black),
      this.users.findOne({ where: { id: white }, select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
      this.users.findOne({ where: { id: black }, select: ['id', 'nickname', 'rating', 'avatarUrl'] }),
    ]);

    const matchPayload = {
      whitePlayer: { id: wp!.id, nickname: wp!.nickname, rating: wp!.rating, avatarUrl: wp!.avatarUrl ?? null },
      blackPlayer: { id: bp!.id, nickname: bp!.nickname, rating: bp!.rating, avatarUrl: bp!.avatarUrl ?? null },
    };

    this.game.emitToUser(white, 'match_found', { matchId: match.id, color: 'white', match: matchPayload });
    this.game.emitToUser(black, 'match_found', { matchId: match.id, color: 'black', match: matchPayload });

    return { status: 'matched', matchId: match.id };
  }

  async denyChallenge(deniedById: string, challengerId: string) {
    const denier = await this.users.findOne({ where: { id: deniedById } });
    this.game.emitToUser(challengerId, 'challenge_rejected', {
      challengedId: deniedById,
      challengedNickname: denier?.nickname,
    });
    return { status: 'denied' };
  }

  // --- Queue sizes ---

  getActiveMatch(userId: string) {
    return this.matches.getActiveMatchForUser(userId);
  }

  getQueueSizes() {
    // Human players in casual queue
    const humanCount = this.casualQueue.filter(e => !e.isBot).length;
    // Available bots always appear as waiting (capped at BOT_VIRTUAL_SLOTS)
    const availableBotCount = Math.min(this.getAvailableBots().length, BOT_VIRTUAL_SLOTS);
    const duel: Record<string, number> = {};
    for (const [key, queue] of this.duelQueues.entries()) {
      duel[key] = queue.length;
    }
    return { casual: humanCount + availableBotCount, duel };
  }

  // --- Helper ---

  private findBestOpponent(queue: QueueEntry[], rating: number): QueueEntry | null {
    if (queue.length === 0) return null;
    return [...queue].sort(
      (a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating),
    )[0];
  }
}
