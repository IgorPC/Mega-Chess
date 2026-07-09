import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MatchesService } from '../matches/matches.service';
import { MatchChatMessage } from '../entities/match-chat-message.entity';
import { User } from '../entities/user.entity';
import { Friendship, FriendshipStatus } from '../entities/friendship.entity';
import { MatchResult, MatchTurn } from '../entities/match.entity';
import { TournamentMatch, MoveTimestamp } from '../entities/tournament-match.entity';
import { TournamentsService } from '../tournaments/tournaments.service';
import { TournamentType } from '../entities/tournament.entity';
import { BotService, BotDifficulty } from '../bots/bot.service';
import { Chess } from 'chess.js';
import { NotificationEventsService } from '../notifications/notification-events.service';

/** Parsed time-control string "3+2" → { initial: 180_000ms, increment: 2_000ms } */
function parseTimeControl(tc: string): { initial: number; increment: number } {
  const [init, inc = '0'] = tc.split('+');
  return {
    initial: parseInt(init) * 60 * 1000,
    increment: parseInt(inc) * 1000,
  };
}

/** Default time control for casual (non-tournament) matches */
const CASUAL_TIME_CONTROL = '3+0';

interface ActiveGame {
  matchId: string;
  whiteId: string;
  blackId: string;
  currentTurn: MatchTurn;
  timer: NodeJS.Timeout | null;

  /** true = proper chess clock (tournament); false = per-move 60s (regular) */
  chessClock: boolean;
  timeControl: string;
  whiteClock: number; // ms remaining
  blackClock: number; // ms remaining
  incrementMs: number;
  lastTurnStart: number; // Date.now() when current turn started

  /** Accumulated move timestamps for tournament history */
  moveTimestamps: MoveTimestamp[];

  /** FEN da posição mais recente (para desempate por material em torneios) */
  currentFen: string;

  // Bot support
  whiteIsBot: boolean;
  blackIsBot: boolean;
  whiteBotDifficulty?: BotDifficulty;
  blackBotDifficulty?: BotDifficulty;
}

@WebSocketGateway({
  namespace: '/game',
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost', credentials: true },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(GameGateway.name);
  private userSockets = new Map<string, string>();
  private activeGames = new Map<string, ActiveGame>();
  private readonly jwtSecret: string;

  constructor(
    private jwt: JwtService,
    config: ConfigService,
    private matches: MatchesService,
    private tournamentsSvc: TournamentsService,
    @InjectRepository(MatchChatMessage) private chatRepo: Repository<MatchChatMessage>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Friendship) private friendships: Repository<Friendship>,
    @InjectRepository(TournamentMatch) private tmRepo: Repository<TournamentMatch>,
    @Inject(REDIS_CLIENT) private redis: Redis,
    private botService: BotService,
    private notificationEvents: NotificationEventsService,
  ) {
    this.jwtSecret = config.getOrThrow<string>('JWT_SECRET');
    this.notificationEvents.onCreated((userId, notification) => {
      this.emitToUser(userId, 'notification_created', notification);
    });
  }

  private getUserId(client: Socket): string | null {
    return (client.data as { userId?: string }).userId ?? null;
  }

  private verifyAndCacheUser(client: Socket): { userId: string; sessionToken: string | null } | null {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];
      const payload = this.jwt.verify<{ sub: string; sessionToken?: string }>(token, { secret: this.jwtSecret });
      (client.data as { userId: string; sessionToken: string | null }).userId = payload.sub;
      (client.data as { userId: string; sessionToken: string | null }).sessionToken = payload.sessionToken ?? null;
      return { userId: payload.sub, sessionToken: payload.sessionToken ?? null };
    } catch { return null; }
  }

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    const parsed = this.verifyAndCacheUser(client);
    if (!parsed) { client.disconnect(); return; }
    const { userId, sessionToken } = parsed;

    // Validate session against Redis if sessionToken is present
    if (sessionToken) {
      const stored = await this.redis.get(`session:${userId}`);
      if (!stored || stored !== sessionToken) {
        client.emit('session_invalidated', { reason: 'Sessão inválida ou expirada' });
        client.disconnect();
        return;
      }
    }

    // Kick previous socket for this user (single-session enforcement)
    const prevSocketId = this.userSockets.get(userId);
    if (prevSocketId && prevSocketId !== client.id) {
      const prevSocket = (this.server.sockets as unknown as Map<string, Socket>).get(prevSocketId);
      if (prevSocket) {
        prevSocket.emit('session_invalidated', { reason: 'Sua conta foi acessada em outro dispositivo' });
        prevSocket.disconnect();
      }
    }

    this.userSockets.set(userId, client.id);
    client.join(`user:${userId}`);
    this.logger.log(`Client connected userId=${userId}`);
    this.usersRepo.update(userId, { isOnline: true }).catch((err) => {
      this.logger.warn(`Failed to set isOnline=true userId=${userId}`, err instanceof Error ? err.stack : String(err));
    });
    this.notifyFriendsOfStatus(userId, true).catch((err) => {
      this.logger.warn(`notifyFriendsOfStatus failed userId=${userId}`, err instanceof Error ? err.stack : String(err));
    });
  }

  handleDisconnect(client: Socket) {
    const userId = this.getUserId(client);
    if (userId) {
      this.userSockets.delete(userId);
      this.logger.log(`Client disconnected userId=${userId}`);
      this.usersRepo.update(userId, { isOnline: false }).catch((err) => {
        this.logger.warn(`Failed to set isOnline=false userId=${userId}`, err instanceof Error ? err.stack : String(err));
      });
      this.notifyFriendsOfStatus(userId, false).catch((err) => {
        this.logger.warn(`notifyFriendsOfStatus failed userId=${userId}`, err instanceof Error ? err.stack : String(err));
      });
    }
  }

  private async notifyFriendsOfStatus(userId: string, online: boolean) {
    const friendIds = await this.getFriendIds(userId);
    const event = online ? 'user_online' : 'user_offline';
    for (const friendId of friendIds) {
      this.emitToUser(friendId, event, { userId });
    }
  }

  private async getFriendIds(userId: string): Promise<string[]> {
    const rows = await this.friendships.find({
      where: [
        { requesterId: userId, status: FriendshipStatus.ACCEPTED },
        { receiverId: userId, status: FriendshipStatus.ACCEPTED },
      ],
      select: ['requesterId', 'receiverId'],
    });
    return rows.map(r => (r.requesterId === userId ? r.receiverId : r.requesterId));
  }

  // ─── Social room ──────────────────────────────────────────────────────────

  @SubscribeMessage('join_social')
  async handleJoinSocial(@ConnectedSocket() client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) return;
    client.join('social');
    const friendIds = await this.getFriendIds(userId);
    // Combine socket-tracking (real-time) with DB flag (fallback for missed connection events)
    const socketOnline = friendIds.filter(id => this.userSockets.has(id));
    const dbOnline = friendIds.length > 0
      ? await this.usersRepo.find({ where: { id: In(friendIds), isOnline: true }, select: ['id'] })
      : [];
    const onlineSet = new Set([...socketOnline, ...dbOnline.map(u => u.id)]);
    client.emit('friends_status', { onlineIds: [...onlineSet] });
  }

  // ─── Game events ──────────────────────────────────────────────────────────

  @SubscribeMessage('join_game')
  async handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    const userId = this.getUserId(client);
    if (!userId) return;

    const match = await this.matches.getMatch(data.matchId);
    if (!match) return;
    if (match.whitePlayerId !== userId && match.blackPlayerId !== userId) return;

    client.join(`game:${data.matchId}`);
    client.emit('game_state', { match });

    if (!this.activeGames.has(data.matchId)) {
      const [tm, whiteUser, blackUser] = await Promise.all([
        this.tmRepo.findOne({ where: { matchId: data.matchId } }),
        this.usersRepo.findOne({ where: { id: match.whitePlayerId }, select: ['id', 'isBot', 'botDifficulty'] }),
        this.usersRepo.findOne({ where: { id: match.blackPlayerId! }, select: ['id', 'isBot', 'botDifficulty'] }),
      ]);

      // Re-check after the await: both players emit join_game almost
      // simultaneously in a duel, and without this guard both would pass the
      // initial has() check and each create a game + clock interval, leaving an
      // orphaned interval running (frozen/erratic clock for one player).
      if (!this.activeGames.has(data.matchId)) {
        // All matches use a proper chess clock; casual defaults to 3+0
        const chessClock = true;
        const timeControl = tm?.timeControl ?? CASUAL_TIME_CONTROL;
        const { initial, increment } = parseTimeControl(timeControl);

        const game: ActiveGame = {
          matchId: data.matchId,
          whiteId: match.whitePlayerId,
          blackId: match.blackPlayerId!,
          currentTurn: match.currentTurn,
          timer: null,
          chessClock,
          timeControl,
          whiteClock: initial,
          blackClock: initial,
          incrementMs: increment,
          lastTurnStart: Date.now(),
          moveTimestamps: [],
          currentFen: match.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          whiteIsBot: whiteUser?.isBot ?? false,
          blackIsBot: blackUser?.isBot ?? false,
          whiteBotDifficulty: (whiteUser?.botDifficulty as BotDifficulty) ?? undefined,
          blackBotDifficulty: (blackUser?.botDifficulty as BotDifficulty) ?? undefined,
        };
        this.activeGames.set(data.matchId, game);
        this.startClock(data.matchId);

        // If bot moves first (it's the bot's turn from the start), schedule immediately
        this.scheduleBotMoveIfNeeded(game);
      }
    }

    // Emit current clock state to joining player
    const game = this.activeGames.get(data.matchId);
    if (game) {
      client.emit('clock_update', {
        whiteClock: game.whiteClock,
        blackClock: game.blackClock,
        turn: game.currentTurn,
      });
    }
  }

  @SubscribeMessage('leave_game')
  handleLeaveGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    client.leave(`game:${data.matchId}`);
  }

  @SubscribeMessage('move')
  async handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; from: string; to: string; promotion?: string },
  ) {
    const userId = this.getUserId(client);
    if (!userId) return;

    const game = this.activeGames.get(data.matchId);
    if (!game) return;

    // Only a participant may move, and only on their own turn.
    const isWhite = game.whiteId === userId;
    const isBlack = game.blackId === userId;
    if (!isWhite && !isBlack) return;
    if ((isWhite && game.currentTurn !== MatchTurn.WHITE) || (isBlack && game.currentTurn !== MatchTurn.BLACK)) return;

    const applied = await this.applyValidatedMove(game, data.from, data.to, data.promotion, isWhite);
    if (!applied) {
      // Illegal / desynced move — tell the offending client to resync to the
      // authoritative server state instead of trusting its optimistic update.
      client.emit('move_rejected', { fen: game.currentFen, turn: game.currentTurn });
    }
  }

  @SubscribeMessage('forfeit')
  async handleForfeit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    const userId = this.getUserId(client);
    if (!userId) return;
    const game = this.activeGames.get(data.matchId);
    if (!game) return;
    // Only an actual participant may forfeit the match.
    if (game.whiteId !== userId && game.blackId !== userId) return;
    const result = game.whiteId === userId ? MatchResult.FORFEIT_WHITE : MatchResult.FORFEIT_BLACK;
    await this.finalizeGame(data.matchId, result, 'forfeit');
  }

  @SubscribeMessage('chat_message')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; content: string },
  ) {
    const userId = this.getUserId(client);
    if (!userId || !data.content?.trim()) return;
    // Only participants of the match may post to its chat.
    const game = this.activeGames.get(data.matchId);
    if (game && game.whiteId !== userId && game.blackId !== userId) return;
    const content = data.content.trim().slice(0, 500);
    const msg = this.chatRepo.create({
      matchId: data.matchId, senderId: userId, content,
    });
    await this.chatRepo.save(msg);
    const full = await this.chatRepo.findOne({ where: { id: msg.id }, relations: ['sender'] });
    this.server.to(`game:${data.matchId}`).emit('chat_message', full);
  }

  // ─── Clock ────────────────────────────────────────────────────────────────

  private startClock(matchId: string) {
    const game = this.activeGames.get(matchId);
    if (!game) return;
    this.clearTimer(matchId);

    if (game.chessClock) {
      // Emit every second; check for timeout
      game.timer = setInterval(async () => {
        const elapsed = Date.now() - game.lastTurnStart;
        const remaining = game.currentTurn === MatchTurn.WHITE
          ? game.whiteClock - elapsed
          : game.blackClock - elapsed;

        this.server.to(`game:${matchId}`).emit('clock_update', {
          whiteClock: game.currentTurn === MatchTurn.WHITE
            ? Math.max(0, game.whiteClock - elapsed)
            : game.whiteClock,
          blackClock: game.currentTurn === MatchTurn.BLACK
            ? Math.max(0, game.blackClock - elapsed)
            : game.blackClock,
          turn: game.currentTurn,
        });

        if (remaining <= 0) {
          this.clearTimer(matchId);
          const result = game.currentTurn === MatchTurn.WHITE
            ? MatchResult.TIMEOUT_WHITE
            : MatchResult.TIMEOUT_BLACK;
          await this.finalizeGame(matchId, result, 'timeout');
        }
      }, 1000);
    } else {
      // Legacy: 60s per-move countdown
      let seconds = 60;
      this.server.to(`game:${matchId}`).emit('timer_update', { seconds, turn: game.currentTurn });
      game.timer = setInterval(async () => {
        seconds--;
        this.server.to(`game:${matchId}`).emit('timer_update', { seconds, turn: game.currentTurn });
        if (seconds <= 0) {
          this.clearTimer(matchId);
          const result = game.currentTurn === MatchTurn.WHITE
            ? MatchResult.TIMEOUT_WHITE
            : MatchResult.TIMEOUT_BLACK;
          await this.finalizeGame(matchId, result, 'timeout');
        }
      }, 1000);
    }
  }

  private clearTimer(matchId: string) {
    const game = this.activeGames.get(matchId);
    if (game?.timer) { clearInterval(game.timer); game.timer = null; }
  }

  private async finalizeGame(matchId: string, result: MatchResult, reason: string) {
    const game = this.activeGames.get(matchId);
    this.clearTimer(matchId);
    this.activeGames.delete(matchId);

    // Release bot back to the pool
    if (game) {
      if (game.whiteIsBot) this.botService.markBotIdle(game.whiteId);
      if (game.blackIsBot) this.botService.markBotIdle(game.blackId);
    }

    await this.matches.finishMatch(matchId, result);
    this.server.to(`game:${matchId}`).emit('game_over', { result, reason });

    if (game) {
      // If tournament match, notify both players to return to the lobby or history
      const tm = await this.tmRepo.findOne({ where: { matchId }, relations: ['tournament'] });
      if (tm) {
        const isDuel = tm.tournament != null && [TournamentType.DUEL_FLASH, TournamentType.DUEL_GIANT].includes(tm.tournament.type);
        const payload = { tournamentId: tm.tournamentId, isDuel };
        this.emitToUser(game.whiteId, 'tournament_match_over', payload);
        this.emitToUser(game.blackId, 'tournament_match_over', payload);
      }

      this.tournamentsSvc.onMatchFinished(
        matchId,
        result,
        game.whiteClock,
        game.blackClock,
        game.moveTimestamps,
        game.currentFen,
      ).catch((err) => {
        this.logger.error(`onMatchFinished failed matchId=${matchId}`, err instanceof Error ? err.stack : String(err));
      });
    }
  }

  // ─── Bot support ─────────────────────────────────────────────────────────

  private scheduleBotMoveIfNeeded(game: ActiveGame) {
    if (new Chess(game.currentFen).isGameOver()) return;

    const isWhiteTurn = game.currentTurn === MatchTurn.WHITE;
    const botId = isWhiteTurn ? (game.whiteIsBot ? game.whiteId : null) : (game.blackIsBot ? game.blackId : null);
    if (!botId) return;

    const difficulty = isWhiteTurn ? game.whiteBotDifficulty : game.blackBotDifficulty;
    if (!difficulty) return;

    const fen = game.currentFen;
    const matchId = game.matchId;
    const remainingClockMs = isWhiteTurn ? game.whiteClock : game.blackClock;

    this.botService.scheduleMove(matchId, botId, difficulty, fen, remainingClockMs, async (uci) => {
      await this.applyBotMove(matchId, botId, uci);
    });
  }

  async applyBotMove(matchId: string, botId: string, uci: string) {
    const game = this.activeGames.get(matchId);
    if (!game) return;

    const isWhite = game.whiteId === botId;
    if ((isWhite && game.currentTurn !== MatchTurn.WHITE) || (!isWhite && game.currentTurn !== MatchTurn.BLACK)) return;

    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    const applied = await this.applyValidatedMove(game, from, to, promotion, isWhite);
    if (!applied) {
      this.logger.warn(`[bot] Illegal move ${uci} in matchId=${matchId} fen=${game.currentFen}`);
    }
  }

  /**
   * Server-authoritative move application, shared by human and bot paths.
   * Validates against the canonical in-memory FEN, updates clocks, persists,
   * broadcasts, and finalizes the game if it ended. Returns false (without any
   * side effects) if the move is illegal for the current position.
   */
  private async applyValidatedMove(
    game: ActiveGame,
    from: string,
    to: string,
    promotion: string | undefined,
    isWhite: boolean,
  ): Promise<boolean> {
    const matchId = game.matchId;
    const chess = new Chess(game.currentFen);
    // chess.js throws (rather than returning null) for an illegal move.
    let moveResult: ReturnType<Chess['move']> | null;
    try {
      moveResult = chess.move({ from, to, promotion });
    } catch {
      moveResult = null;
    }
    if (!moveResult) return false;

    const newFen = chess.fen();
    const newPgn = chess.pgn();

    const elapsed = Date.now() - game.lastTurnStart;
    this.clearTimer(matchId);

    if (game.chessClock) {
      if (isWhite) {
        game.whiteClock = Math.max(0, game.whiteClock - elapsed + game.incrementMs);
      } else {
        game.blackClock = Math.max(0, game.blackClock - elapsed + game.incrementMs);
      }
      game.moveTimestamps.push({
        san: moveResult.san,
        from, to,
        piece: moveResult.piece ?? null,
        captured: moveResult.captured ?? null,
        fen: newFen,
        elapsed_ms: elapsed,
        clock_ms: isWhite ? game.whiteClock : game.blackClock,
        player: isWhite ? 'white' : 'black',
      });
    }

    await this.matches.updateFen(matchId, newFen, newPgn, []);
    game.currentFen = newFen;
    game.currentTurn = game.currentTurn === MatchTurn.WHITE ? MatchTurn.BLACK : MatchTurn.WHITE;
    game.lastTurnStart = Date.now();

    this.server.to(`game:${matchId}`).emit('move_broadcast', {
      from, to, promotion: moveResult.promotion,
      fen: newFen, pgn: newPgn, moves: [moveResult.san], turn: game.currentTurn,
    });

    if (game.chessClock) {
      this.server.to(`game:${matchId}`).emit('clock_update', {
        whiteClock: game.whiteClock, blackClock: game.blackClock, turn: game.currentTurn,
      });
    } else {
      this.server.to(`game:${matchId}`).emit('timer_update', { seconds: 60, turn: game.currentTurn });
    }

    if (chess.isGameOver()) {
      let result = MatchResult.DRAW;
      if (chess.isCheckmate()) {
        result = game.currentTurn === MatchTurn.WHITE ? MatchResult.BLACK_WINS : MatchResult.WHITE_WINS;
      }
      await this.finalizeGame(matchId, result, chess.isCheckmate() ? 'checkmate' : 'draw');
      return true;
    }

    this.startClock(matchId);
    this.scheduleBotMoveIfNeeded(game);
    return true;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
