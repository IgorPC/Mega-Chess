import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { GameGateway } from './game.gateway';
import { MatchesService } from '../matches/matches.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { BotService } from '../bots/bot.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { MatchChatMessage } from '../entities/match-chat-message.entity';
import { User } from '../entities/user.entity';
import { Friendship, FriendshipStatus } from '../entities/friendship.entity';
import { MatchResult, MatchTurn } from '../entities/match.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';
import { TournamentType } from '../entities/tournament.entity';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// White to move, Re1-e8# delivers checkmate.
const MATE_IN_ONE_FEN = '6k1/5ppp/8/8/8/8/8/K3R3 w - - 0 1';
// White to move, Nc7xa8 leaves King+Knight vs King — insufficient material draw.
const DRAW_IN_ONE_FEN = 'n6k/2N5/8/8/8/8/6K1/8 w - - 0 1';

function fakeRoomEmitter() {
  return { emit: jest.fn() };
}

function fakeSocket(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? 'socket-1',
    data: {},
    handshake: { auth: {}, headers: {} },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    ...overrides,
  };
}

describe('GameGateway', () => {
  let gateway: GameGateway;
  let jwt: jest.Mocked<JwtService>;
  let matches: jest.Mocked<MatchesService>;
  let tournamentsSvc: jest.Mocked<TournamentsService>;
  let chatRepo: jest.Mocked<Repository<MatchChatMessage>>;
  let usersRepo: jest.Mocked<Repository<User>>;
  let friendships: jest.Mocked<Repository<Friendship>>;
  let tmRepo: jest.Mocked<Repository<TournamentMatch>>;
  let redis: { get: jest.Mock };
  let botService: jest.Mocked<BotService>;
  let notificationEvents: { onCreated: jest.Mock };
  let serverToMock: jest.Mock;

  beforeEach(async () => {
    jest.useFakeTimers();

    const module = await Test.createTestingModule({
      providers: [
        GameGateway,
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn(() => 'jwt-secret') } },
        {
          provide: MatchesService,
          useValue: { getMatch: jest.fn(), finishMatch: jest.fn().mockResolvedValue(undefined), updateFen: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: TournamentsService, useValue: { onMatchFinished: jest.fn().mockResolvedValue(undefined) } },
        { provide: getRepositoryToken(MatchChatMessage), useValue: { create: jest.fn((v) => ({ id: 'msg-1', ...v })), save: jest.fn().mockResolvedValue(undefined), findOne: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { update: jest.fn().mockResolvedValue(undefined), findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(Friendship), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(TournamentMatch), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: REDIS_CLIENT, useValue: { get: jest.fn() } },
        { provide: BotService, useValue: { markBotIdle: jest.fn(), scheduleMove: jest.fn(), isActive: jest.fn(), markBotActive: jest.fn() } },
        { provide: NotificationEventsService, useValue: { onCreated: jest.fn() } },
      ],
    }).compile();

    gateway = module.get(GameGateway);
    jwt = module.get(JwtService);
    matches = module.get(MatchesService);
    tournamentsSvc = module.get(TournamentsService);
    chatRepo = module.get(getRepositoryToken(MatchChatMessage));
    usersRepo = module.get(getRepositoryToken(User));
    friendships = module.get(getRepositoryToken(Friendship));
    tmRepo = module.get(getRepositoryToken(TournamentMatch));
    redis = module.get(REDIS_CLIENT);
    botService = module.get(BotService);
    notificationEvents = module.get(NotificationEventsService);

    serverToMock = jest.fn(() => fakeRoomEmitter());
    (gateway as any).server = { to: serverToMock, sockets: new Map() };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ─── Constructor wiring ───────────────────────────────────────────────────

  describe('constructor', () => {
    it('forwards new notifications to the target user over the socket', () => {
      const [listener] = notificationEvents.onCreated.mock.calls[0];
      listener('user-1', { id: 'n1' });
      expect(serverToMock).toHaveBeenCalledWith('user:user-1');
    });
  });

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('disconnects the client when the token is invalid', async () => {
      jwt.verify.mockImplementation(() => { throw new Error('bad token'); });
      const client = fakeSocket({ handshake: { auth: { token: 'bad' }, headers: {} } });

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins the personal room and marks the user online when the token is valid (no session check)', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      const client = fakeSocket({ handshake: { auth: { token: 'good' }, headers: {} } });

      await gateway.handleConnection(client as any);

      expect(client.join).toHaveBeenCalledWith('user:user-1');
      expect(usersRepo.update).toHaveBeenCalledWith('user-1', { isOnline: true });
    });

    it('rejects the connection when the session token does not match Redis', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1', sessionToken: 'abc' });
      redis.get.mockResolvedValue('different-token');
      const client = fakeSocket({ handshake: { auth: { token: 'good' }, headers: {} } });

      await gateway.handleConnection(client as any);

      expect(client.emit).toHaveBeenCalledWith('session_invalidated', expect.any(Object));
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('rejects the connection when Redis has no session stored at all', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1', sessionToken: 'abc' });
      redis.get.mockResolvedValue(null);
      const client = fakeSocket({ handshake: { auth: { token: 'good' }, headers: {} } });

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('accepts the connection when the session token matches Redis', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1', sessionToken: 'abc' });
      redis.get.mockResolvedValue('abc');
      const client = fakeSocket({ handshake: { auth: { token: 'good' }, headers: {} } });

      await gateway.handleConnection(client as any);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith('user:user-1');
    });

    it('kicks the previous socket for the same user (single-session enforcement)', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      const first = fakeSocket({ id: 'socket-old', handshake: { auth: { token: 'good' }, headers: {} } });
      await gateway.handleConnection(first as any);

      const prevSocket = fakeSocket({ id: 'socket-old' });
      (gateway as any).server.sockets.set('socket-old', prevSocket);

      const second = fakeSocket({ id: 'socket-new', handshake: { auth: { token: 'good' }, headers: {} } });
      await gateway.handleConnection(second as any);

      expect(prevSocket.emit).toHaveBeenCalledWith('session_invalidated', expect.any(Object));
      expect(prevSocket.disconnect).toHaveBeenCalled();
    });

    it('reads the token from the Authorization header when handshake.auth has none', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      const client = fakeSocket({ handshake: { auth: {}, headers: { authorization: 'Bearer header-token' } } });

      await gateway.handleConnection(client as any);

      expect(jwt.verify).toHaveBeenCalledWith('header-token', expect.any(Object));
    });

    it('notifies each accepted friend that the user came online', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      friendships.find.mockResolvedValue([
        { requesterId: 'user-1', receiverId: 'friend-1' } as Friendship,
        { requesterId: 'friend-2', receiverId: 'user-1' } as Friendship,
      ]);
      const client = fakeSocket({ handshake: { auth: { token: 'good' }, headers: {} } });

      await gateway.handleConnection(client as any);
      await Promise.resolve();
      await Promise.resolve();

      expect(serverToMock).toHaveBeenCalledWith('user:friend-1');
      expect(serverToMock).toHaveBeenCalledWith('user:friend-2');
    });

    it('does not throw when persisting the online flag or friend lookup fails in the background', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      usersRepo.update.mockRejectedValue(new Error('db down'));
      friendships.find.mockRejectedValue(new Error('db down'));
      const client = fakeSocket({ handshake: { auth: { token: 'good' }, headers: {} } });

      await expect(gateway.handleConnection(client as any)).resolves.not.toThrow();
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  describe('handleDisconnect', () => {
    it('marks the user offline and notifies friends when the user is known', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      const client = fakeSocket({ handshake: { auth: { token: 'good' }, headers: {} } });
      await gateway.handleConnection(client as any);

      gateway.handleDisconnect(client as any);
      await Promise.resolve();

      expect(usersRepo.update).toHaveBeenCalledWith('user-1', { isOnline: false });
    });

    it('does nothing when the client has no associated userId', () => {
      const client = fakeSocket();
      expect(() => gateway.handleDisconnect(client as any)).not.toThrow();
      expect(usersRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── Social room ──────────────────────────────────────────────────────────

  describe('handleJoinSocial', () => {
    it('does nothing without an authenticated user', async () => {
      const client = fakeSocket();
      await gateway.handleJoinSocial(client as any);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins the social room and reports which friends are online', async () => {
      const client = fakeSocket({ data: { userId: 'user-1' } });
      friendships.find.mockResolvedValue([
        { requesterId: 'user-1', receiverId: 'friend-1' } as Friendship,
      ]);
      usersRepo.find.mockResolvedValue([{ id: 'friend-1' } as User]);

      await gateway.handleJoinSocial(client as any);

      expect(client.join).toHaveBeenCalledWith('social');
      expect(client.emit).toHaveBeenCalledWith('friends_status', { onlineIds: ['friend-1'] });
    });
  });

  // ─── join_game ────────────────────────────────────────────────────────────

  describe('handleJoinGame', () => {
    it('does nothing without an authenticated user', async () => {
      const client = fakeSocket();
      await gateway.handleJoinGame(client as any, { matchId: 'm1' });
      expect(matches.getMatch).not.toHaveBeenCalled();
    });

    it('does nothing when the match does not exist', async () => {
      const client = fakeSocket({ data: { userId: 'user-1' } });
      matches.getMatch.mockResolvedValue(null as any);

      await gateway.handleJoinGame(client as any, { matchId: 'missing' });

      expect(client.join).not.toHaveBeenCalled();
    });

    it('does nothing when the user is not a participant of the match', async () => {
      const client = fakeSocket({ data: { userId: 'outsider' } });
      matches.getMatch.mockResolvedValue({
        id: 'm1', whitePlayerId: 'white-1', blackPlayerId: 'black-1', currentTurn: MatchTurn.WHITE, fen: START_FEN,
      } as any);

      await gateway.handleJoinGame(client as any, { matchId: 'm1' });

      expect(client.join).not.toHaveBeenCalled();
    });

    it('creates a new active game on first join and starts the clock', async () => {
      const client = fakeSocket({ data: { userId: 'white-1' } });
      matches.getMatch.mockResolvedValue({
        id: 'm1', whitePlayerId: 'white-1', blackPlayerId: 'black-1', currentTurn: MatchTurn.WHITE, fen: START_FEN,
      } as any);
      usersRepo.findOne.mockResolvedValue({ id: 'white-1', isBot: false } as any);

      await gateway.handleJoinGame(client as any, { matchId: 'm1' });

      expect(client.join).toHaveBeenCalledWith('game:m1');
      expect(client.emit).toHaveBeenCalledWith('game_state', expect.any(Object));
      expect(client.emit).toHaveBeenCalledWith('clock_update', expect.objectContaining({ turn: MatchTurn.WHITE }));
    });

    it('does not recreate the game when a second participant joins the same match', async () => {
      matches.getMatch.mockResolvedValue({
        id: 'm1', whitePlayerId: 'white-1', blackPlayerId: 'black-1', currentTurn: MatchTurn.WHITE, fen: START_FEN,
      } as any);
      usersRepo.findOne.mockResolvedValue({ id: 'white-1', isBot: false } as any);

      const first = fakeSocket({ data: { userId: 'white-1' } });
      await gateway.handleJoinGame(first as any, { matchId: 'm1' });

      const secondCallsBefore = tmRepo.findOne.mock.calls.length;
      const second = fakeSocket({ data: { userId: 'black-1' } });
      await gateway.handleJoinGame(second as any, { matchId: 'm1' });

      expect(tmRepo.findOne.mock.calls.length).toBe(secondCallsBefore);
      expect(second.emit).toHaveBeenCalledWith('clock_update', expect.any(Object));
    });

    it('schedules a bot move immediately when the bot moves first', async () => {
      matches.getMatch.mockResolvedValue({
        id: 'm1', whitePlayerId: 'bot-1', blackPlayerId: 'human-1', currentTurn: MatchTurn.WHITE, fen: START_FEN,
      } as any);
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'bot-1', isBot: true, botDifficulty: 'EASY' } as any)
        .mockResolvedValueOnce({ id: 'human-1', isBot: false } as any);

      const client = fakeSocket({ data: { userId: 'human-1' } });
      await gateway.handleJoinGame(client as any, { matchId: 'm1' });

      expect(botService.scheduleMove).toHaveBeenCalledWith(
        'm1', 'bot-1', 'EASY', START_FEN, expect.any(Number), expect.any(Function),
      );
    });

    it('applies the bot move once the scheduled callback resolves with a UCI move', async () => {
      matches.getMatch.mockResolvedValue({
        id: 'm1', whitePlayerId: 'bot-1', blackPlayerId: 'human-1', currentTurn: MatchTurn.WHITE, fen: START_FEN,
      } as any);
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'bot-1', isBot: true, botDifficulty: 'EASY' } as any)
        .mockResolvedValueOnce({ id: 'human-1', isBot: false } as any);

      const client = fakeSocket({ data: { userId: 'human-1' } });
      await gateway.handleJoinGame(client as any, { matchId: 'm1' });

      const [, , , , , applyMove] = botService.scheduleMove.mock.calls[0];
      await applyMove('e2e4');

      expect(matches.updateFen).toHaveBeenCalled();
    });
  });

  describe('handleLeaveGame', () => {
    it('leaves the match room', () => {
      const client = fakeSocket();
      gateway.handleLeaveGame(client as any, { matchId: 'm1' });
      expect(client.leave).toHaveBeenCalledWith('game:m1');
    });
  });

  // ─── move ─────────────────────────────────────────────────────────────────

  async function joinFreshGame(overrides: Partial<{ whiteId: string; blackId: string; fen: string; turn: MatchTurn }> = {}) {
    const whiteId = overrides.whiteId ?? 'white-1';
    const blackId = overrides.blackId ?? 'black-1';
    matches.getMatch.mockResolvedValue({
      id: 'm1', whitePlayerId: whiteId, blackPlayerId: blackId,
      currentTurn: overrides.turn ?? MatchTurn.WHITE, fen: overrides.fen ?? START_FEN,
    } as any);
    usersRepo.findOne.mockResolvedValue({ id: whiteId, isBot: false } as any);
    const client = fakeSocket({ data: { userId: whiteId } });
    await gateway.handleJoinGame(client as any, { matchId: 'm1' });
    return { whiteId, blackId };
  }

  describe('handleMove', () => {
    it('does nothing without an authenticated user', async () => {
      const client = fakeSocket();
      await gateway.handleMove(client as any, { matchId: 'm1', from: 'e2', to: 'e4' });
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('does nothing when there is no active game for the match', async () => {
      const client = fakeSocket({ data: { userId: 'white-1' } });
      await gateway.handleMove(client as any, { matchId: 'unknown-match', from: 'e2', to: 'e4' });
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('ignores a move from someone who is not a participant', async () => {
      const { } = await joinFreshGame();
      const client = fakeSocket({ data: { userId: 'outsider' } });

      await gateway.handleMove(client as any, { matchId: 'm1', from: 'e2', to: 'e4' });

      expect(matches.updateFen).not.toHaveBeenCalled();
    });

    it('ignores a move played out of turn', async () => {
      const { blackId } = await joinFreshGame({ turn: MatchTurn.WHITE });
      const client = fakeSocket({ data: { userId: blackId } });

      await gateway.handleMove(client as any, { matchId: 'm1', from: 'e7', to: 'e5' });

      expect(matches.updateFen).not.toHaveBeenCalled();
    });

    it('rejects an illegal move and tells the client to resync', async () => {
      const { whiteId } = await joinFreshGame();
      const client = fakeSocket({ data: { userId: whiteId } });

      await gateway.handleMove(client as any, { matchId: 'm1', from: 'e2', to: 'e5' });

      expect(client.emit).toHaveBeenCalledWith('move_rejected', expect.objectContaining({ turn: MatchTurn.WHITE }));
      expect(matches.updateFen).not.toHaveBeenCalled();
    });

    it('applies a legal move, persists it and broadcasts the new state', async () => {
      const { whiteId } = await joinFreshGame();
      const client = fakeSocket({ data: { userId: whiteId } });

      await gateway.handleMove(client as any, { matchId: 'm1', from: 'e2', to: 'e4' });

      expect(matches.updateFen).toHaveBeenCalled();
      expect(serverToMock).toHaveBeenCalledWith('game:m1');
      expect(client.emit).not.toHaveBeenCalledWith('move_rejected', expect.anything());
    });

    it('finalizes the match as a win for the mover on checkmate', async () => {
      const { whiteId } = await joinFreshGame({ fen: MATE_IN_ONE_FEN });
      const client = fakeSocket({ data: { userId: whiteId } });

      await gateway.handleMove(client as any, { matchId: 'm1', from: 'e1', to: 'e8' });

      expect(matches.finishMatch).toHaveBeenCalledWith('m1', MatchResult.WHITE_WINS);
    });

    it('finalizes the match as a draw on insufficient material', async () => {
      const { whiteId } = await joinFreshGame({ fen: DRAW_IN_ONE_FEN });
      const client = fakeSocket({ data: { userId: whiteId } });

      await gateway.handleMove(client as any, { matchId: 'm1', from: 'c7', to: 'a8' });

      expect(matches.finishMatch).toHaveBeenCalledWith('m1', MatchResult.DRAW);
    });

    it('notifies both players and the tournament service when a tournament match ends', async () => {
      tmRepo.findOne.mockResolvedValue({
        matchId: 'm1', tournamentId: 't1', tournament: { type: TournamentType.DUEL_FLASH },
      } as any);
      const { whiteId } = await joinFreshGame({ fen: MATE_IN_ONE_FEN });
      const client = fakeSocket({ data: { userId: whiteId } });

      await gateway.handleMove(client as any, { matchId: 'm1', from: 'e1', to: 'e8' });
      await Promise.resolve();

      expect(serverToMock).toHaveBeenCalledWith('user:white-1');
      expect(serverToMock).toHaveBeenCalledWith('user:black-1');
      expect(tournamentsSvc.onMatchFinished).toHaveBeenCalled();
    });

    it('logs but does not throw when the tournament finish hook rejects', async () => {
      tournamentsSvc.onMatchFinished.mockRejectedValue(new Error('boom'));
      const { whiteId } = await joinFreshGame({ fen: MATE_IN_ONE_FEN });
      const client = fakeSocket({ data: { userId: whiteId } });

      await expect(
        gateway.handleMove(client as any, { matchId: 'm1', from: 'e1', to: 'e8' }),
      ).resolves.not.toThrow();
      await Promise.resolve();
    });
  });

  // ─── forfeit ──────────────────────────────────────────────────────────────

  describe('handleForfeit', () => {
    it('does nothing without an authenticated user', async () => {
      const client = fakeSocket();
      await gateway.handleForfeit(client as any, { matchId: 'm1' });
      expect(matches.finishMatch).not.toHaveBeenCalled();
    });

    it('does nothing when there is no active game', async () => {
      const client = fakeSocket({ data: { userId: 'white-1' } });
      await gateway.handleForfeit(client as any, { matchId: 'unknown' });
      expect(matches.finishMatch).not.toHaveBeenCalled();
    });

    it('ignores a forfeit request from a non-participant', async () => {
      await joinFreshGame();
      const client = fakeSocket({ data: { userId: 'outsider' } });

      await gateway.handleForfeit(client as any, { matchId: 'm1' });

      expect(matches.finishMatch).not.toHaveBeenCalled();
    });

    it('finishes the match as FORFEIT_WHITE when the white player forfeits', async () => {
      const { whiteId } = await joinFreshGame();
      const client = fakeSocket({ data: { userId: whiteId } });

      await gateway.handleForfeit(client as any, { matchId: 'm1' });

      expect(matches.finishMatch).toHaveBeenCalledWith('m1', MatchResult.FORFEIT_WHITE);
    });

    it('finishes the match as FORFEIT_BLACK when the black player forfeits', async () => {
      const { blackId } = await joinFreshGame();
      const client = fakeSocket({ data: { userId: blackId } });

      await gateway.handleForfeit(client as any, { matchId: 'm1' });

      expect(matches.finishMatch).toHaveBeenCalledWith('m1', MatchResult.FORFEIT_BLACK);
    });

    it('releases both bot slots back to the pool when finalizing a bot match', async () => {
      matches.getMatch.mockResolvedValue({
        id: 'm1', whitePlayerId: 'bot-1', blackPlayerId: 'human-1', currentTurn: MatchTurn.WHITE, fen: START_FEN,
      } as any);
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'bot-1', isBot: true, botDifficulty: 'EASY' } as any)
        .mockResolvedValueOnce({ id: 'human-1', isBot: false } as any);
      const client = fakeSocket({ data: { userId: 'human-1' } });
      await gateway.handleJoinGame(client as any, { matchId: 'm1' });

      await gateway.handleForfeit(client as any, { matchId: 'm1' });

      expect(botService.markBotIdle).toHaveBeenCalledWith('bot-1');
    });
  });

  // ─── chat_message ─────────────────────────────────────────────────────────

  describe('handleChatMessage', () => {
    it('ignores a message without an authenticated user', async () => {
      const client = fakeSocket();
      await gateway.handleChatMessage(client as any, { matchId: 'm1', content: 'hi' });
      expect(chatRepo.save).not.toHaveBeenCalled();
    });

    it('ignores an empty/whitespace-only message', async () => {
      const client = fakeSocket({ data: { userId: 'white-1' } });
      await gateway.handleChatMessage(client as any, { matchId: 'm1', content: '   ' });
      expect(chatRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a message from a non-participant when the match is active', async () => {
      await joinFreshGame();
      const client = fakeSocket({ data: { userId: 'outsider' } });

      await gateway.handleChatMessage(client as any, { matchId: 'm1', content: 'hello' });

      expect(chatRepo.save).not.toHaveBeenCalled();
    });

    it('saves and broadcasts a trimmed message from a participant', async () => {
      const { whiteId } = await joinFreshGame();
      const client = fakeSocket({ data: { userId: whiteId } });
      chatRepo.findOne.mockResolvedValue({ id: 'msg-1', content: 'hello' } as any);

      await gateway.handleChatMessage(client as any, { matchId: 'm1', content: '  hello  ' });

      expect(chatRepo.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'hello' }));
      expect(chatRepo.save).toHaveBeenCalled();
      expect(serverToMock).toHaveBeenCalledWith('game:m1');
    });

    it('truncates messages longer than 500 characters', async () => {
      const { whiteId } = await joinFreshGame();
      const client = fakeSocket({ data: { userId: whiteId } });
      chatRepo.findOne.mockResolvedValue({ id: 'msg-1' } as any);
      const longMessage = 'a'.repeat(600);

      await gateway.handleChatMessage(client as any, { matchId: 'm1', content: longMessage });

      const created = chatRepo.create.mock.calls[0][0] as any;
      expect(created.content.length).toBe(500);
    });
  });

  // ─── Clock / timeout ──────────────────────────────────────────────────────

  describe('clock timeout', () => {
    it('finalizes the match with a timeout result once the active player runs out of time', async () => {
      matches.getMatch.mockResolvedValue({
        id: 'm1', whitePlayerId: 'white-1', blackPlayerId: 'black-1', currentTurn: MatchTurn.WHITE,
        fen: START_FEN, // no tm.timeControl override -> defaults to casual '3+0' (180s)
      } as any);
      usersRepo.findOne.mockResolvedValue({ id: 'white-1', isBot: false } as any);
      const client = fakeSocket({ data: { userId: 'white-1' } });
      await gateway.handleJoinGame(client as any, { matchId: 'm1' });

      await jest.advanceTimersByTimeAsync(181_000);

      expect(matches.finishMatch).toHaveBeenCalledWith('m1', MatchResult.TIMEOUT_WHITE);
    });
  });

  // ─── Bot move application ─────────────────────────────────────────────────

  describe('applyBotMove', () => {
    // Black to move (after 1. e4) — needed so `e7e5` is actually legal for the bot.
    const BLACK_TO_MOVE_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

    async function joinBotGame(turn: MatchTurn = MatchTurn.BLACK) {
      matches.getMatch.mockResolvedValue({
        id: 'm1', whitePlayerId: 'human-1', blackPlayerId: 'bot-1', currentTurn: turn,
        fen: turn === MatchTurn.BLACK ? BLACK_TO_MOVE_FEN : START_FEN,
      } as any);
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'human-1', isBot: false } as any)
        .mockResolvedValueOnce({ id: 'bot-1', isBot: true, botDifficulty: 'EASY' } as any);
      const client = fakeSocket({ data: { userId: 'human-1' } });
      await gateway.handleJoinGame(client as any, { matchId: 'm1' });
    }

    it('does nothing when the match no longer has an active game', async () => {
      await gateway.applyBotMove('missing-match', 'bot-1', 'e7e5');
      expect(matches.updateFen).not.toHaveBeenCalled();
    });

    it('ignores a bot move submitted out of turn', async () => {
      await joinBotGame(MatchTurn.WHITE); // it's white's (human) turn, not the bot's
      await gateway.applyBotMove('m1', 'bot-1', 'e7e5');
      expect(matches.updateFen).not.toHaveBeenCalled();
    });

    it('logs a warning for an illegal bot UCI move without throwing', async () => {
      await joinBotGame(MatchTurn.BLACK);
      await expect(gateway.applyBotMove('m1', 'bot-1', 'e7e2')).resolves.not.toThrow();
      expect(matches.updateFen).not.toHaveBeenCalled();
    });

    it('applies a legal bot move', async () => {
      await joinBotGame(MatchTurn.BLACK);
      await gateway.applyBotMove('m1', 'bot-1', 'e7e5');
      expect(matches.updateFen).toHaveBeenCalled();
    });
  });

  // ─── emitToUser ───────────────────────────────────────────────────────────

  describe('emitToUser', () => {
    it('emits the event to the user-scoped room', () => {
      gateway.emitToUser('user-1', 'some_event', { foo: 'bar' });
      expect(serverToMock).toHaveBeenCalledWith('user:user-1');
    });
  });
});
