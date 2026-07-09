import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchmakingService } from './matchmaking.service';
import { MatchesService } from '../matches/matches.service';
import { GameGateway } from '../game/game.gateway';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { BotService } from '../bots/bot.service';
import { User } from '../entities/user.entity';
import { Tournament, TournamentType, TournamentStatus } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';

describe('MatchmakingService', () => {
  let service: MatchmakingService;
  let matches: jest.Mocked<MatchesService>;
  let game: jest.Mocked<GameGateway>;
  let wallet: jest.Mocked<WalletService>;
  let notifications: jest.Mocked<NotificationsService>;
  let usersRepo: jest.Mocked<Repository<User>>;
  let tournamentsRepo: jest.Mocked<Repository<Tournament>>;
  let participantsRepo: jest.Mocked<Repository<TournamentParticipant>>;
  let tournamentMatchesRepo: jest.Mocked<Repository<TournamentMatch>>;
  let activity: jest.Mocked<UserActivityService>;
  let botService: jest.Mocked<BotService>;

  function userRow(overrides: Partial<User> = {}): User {
    return { id: 'user-1', rating: 1200, nickname: 'Alice', avatarUrl: null, isBot: false, botDifficulty: null, birthDate: '1990-01-01', ...overrides } as User;
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        { provide: MatchesService, useValue: { createMatch: jest.fn(), getActiveMatchForUser: jest.fn() } },
        { provide: GameGateway, useValue: { emitToUser: jest.fn() } },
        { provide: WalletService, useValue: { assertBalance: jest.fn(), debit: jest.fn(), credit: jest.fn() } },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(1), save: jest.fn(), create: jest.fn((v) => v) },
        },
        { provide: getRepositoryToken(Tournament), useValue: { save: jest.fn(), create: jest.fn((v) => v), update: jest.fn() } },
        { provide: getRepositoryToken(TournamentParticipant), useValue: { save: jest.fn(), create: jest.fn((v) => v) } },
        { provide: getRepositoryToken(TournamentMatch), useValue: { save: jest.fn(), create: jest.fn((v) => v) } },
        { provide: UserActivityService, useValue: { log: jest.fn() } },
        { provide: BotService, useValue: { isActive: jest.fn().mockReturnValue(false), markBotActive: jest.fn(), markBotIdle: jest.fn() } },
      ],
    }).compile();

    service = module.get(MatchmakingService);
    matches = module.get(MatchesService);
    game = module.get(GameGateway);
    wallet = module.get(WalletService);
    notifications = module.get(NotificationsService);
    usersRepo = module.get(getRepositoryToken(User));
    tournamentsRepo = module.get(getRepositoryToken(Tournament));
    participantsRepo = module.get(getRepositoryToken(TournamentParticipant));
    tournamentMatchesRepo = module.get(getRepositoryToken(TournamentMatch));
    activity = module.get(UserActivityService);
    botService = module.get(BotService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // ─── Lifecycle / bot seeding ────────────────────────────────────────────────

  describe('onModuleInit / onModuleDestroy', () => {
    it('does not seed bots when some already exist, but does load them', async () => {
      usersRepo.count.mockResolvedValue(5);
      usersRepo.find.mockResolvedValue([userRow({ id: 'bot-1', isBot: true })]);

      await service.onModuleInit();

      expect(usersRepo.save).not.toHaveBeenCalled();
      expect(usersRepo.find).toHaveBeenCalledWith({ where: { isBot: true } });
    });

    it('seeds the default bot roster when none exist yet', async () => {
      usersRepo.count.mockResolvedValue(0);
      usersRepo.save.mockResolvedValue({} as any);

      await service.onModuleInit();

      expect(usersRepo.save).toHaveBeenCalledTimes(10);
    });

    it('continues seeding remaining bots even if one insert fails', async () => {
      usersRepo.count.mockResolvedValue(0);
      usersRepo.save
        .mockRejectedValueOnce(new Error('duplicate nickname'))
        .mockResolvedValue({} as any);

      await expect(service.onModuleInit()).resolves.not.toThrow();
      expect(usersRepo.save).toHaveBeenCalledTimes(10);
    });

    it('clears the bot-injection interval on module destroy', async () => {
      jest.useFakeTimers();
      usersRepo.count.mockResolvedValue(1);
      await service.onModuleInit();

      const clearSpy = jest.spyOn(global, 'clearInterval');
      service.onModuleDestroy();

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  // ─── Casual queue ───────────────────────────────────────────────────────────

  describe('joinQueue', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.joinQueue('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('queues the user when no opponent is waiting', async () => {
      usersRepo.findOne.mockResolvedValue(userRow({ id: 'user-1', rating: 1200 }));

      const result = await service.joinQueue('user-1');

      expect(result).toEqual({ status: 'queued' });
      expect(activity.log).toHaveBeenCalledWith('user-1', expect.anything(), { queue: 'casual' });
    });

    it('returns already_queued when the same user calls joinQueue twice', async () => {
      usersRepo.findOne.mockResolvedValue(userRow({ id: 'user-1' }));
      await service.joinQueue('user-1');

      const result = await service.joinQueue('user-1');

      expect(result).toEqual({ status: 'already_queued' });
    });

    it('matches two waiting humans and creates a match for both', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(userRow({ id: 'user-1', rating: 1200 }))
        .mockResolvedValueOnce(userRow({ id: 'user-2', rating: 1210 }))
        .mockResolvedValueOnce(userRow({ id: 'user-1', rating: 1200 })) // startCasualMatch white lookup
        .mockResolvedValueOnce(userRow({ id: 'user-2', rating: 1210 })); // startCasualMatch black lookup
      matches.createMatch.mockResolvedValue({ id: 'match-1' } as any);

      await service.joinQueue('user-1');
      const result = await service.joinQueue('user-2');

      expect(result).toEqual({ status: 'matched', matchId: 'match-1' });
      expect(game.emitToUser).toHaveBeenCalledTimes(2);
    });

    it('does not notify a bot opponent over the socket (only humans)', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(userRow({ id: 'user-1', rating: 1200 }))
        .mockResolvedValueOnce(userRow({ id: 'user-2', rating: 1210 }))
        .mockResolvedValueOnce(userRow({ id: 'user-1', rating: 1200, isBot: false }))
        .mockResolvedValueOnce(userRow({ id: 'user-2', rating: 1210, isBot: true }));
      matches.createMatch.mockResolvedValue({ id: 'match-1' } as any);

      await service.joinQueue('user-1');
      await service.joinQueue('user-2');

      expect(game.emitToUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('leaveQueue', () => {
    it('removes a queued user and logs the activity', async () => {
      usersRepo.findOne.mockResolvedValue(userRow({ id: 'user-1' }));
      await service.joinQueue('user-1');

      const result = service.leaveQueue('user-1');

      expect(result).toEqual({ status: 'left' });
      expect(activity.log).toHaveBeenCalledWith('user-1', expect.anything(), { queue: 'casual' });
    });

    it('reports not_in_queue for a user who was never queued', () => {
      const result = service.leaveQueue('never-queued');
      expect(result).toEqual({ status: 'not_in_queue' });
    });
  });

  // ─── Duel queue ─────────────────────────────────────────────────────────────

  describe('joinDuelQueue', () => {
    it('returns already_queued on a double-join attempt', async () => {
      wallet.assertBalance.mockResolvedValue(undefined);
      usersRepo.findOne.mockResolvedValue(userRow());

      // First call resolves the queued state (no await needed before second call races the guard)
      const first = service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any);
      const second = await service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any);
      await first;

      expect(second).toEqual({ status: 'already_queued' });
    });

    it('throws when the user cannot afford the entry fee', async () => {
      wallet.assertBalance.mockRejectedValue(new BadRequestException('Saldo insuficiente'));

      await expect(service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('releases the queue guard after a failed balance check so the user can retry', async () => {
      wallet.assertBalance.mockRejectedValueOnce(new BadRequestException('Saldo insuficiente'));
      await expect(service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any)).rejects.toThrow();

      wallet.assertBalance.mockResolvedValue(undefined);
      usersRepo.findOne.mockResolvedValue(userRow());
      const result = await service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any);

      expect(result).toEqual({ status: 'queued' });
    });

    it('throws NotFoundException when the user record is missing', async () => {
      wallet.assertBalance.mockResolvedValue(undefined);
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when the user has no birth date on file', async () => {
      wallet.assertBalance.mockResolvedValue(undefined);
      usersRepo.findOne.mockResolvedValue(userRow({ birthDate: null }));

      await expect(service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when the user is under 18', async () => {
      wallet.assertBalance.mockResolvedValue(undefined);
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      usersRepo.findOne.mockResolvedValue(userRow({ birthDate: tenYearsAgo.toISOString().slice(0, 10) }));

      await expect(service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('releases the queue guard after a failed age check so the user can retry', async () => {
      wallet.assertBalance.mockResolvedValue(undefined);
      usersRepo.findOne.mockResolvedValueOnce(userRow({ birthDate: null }));
      await expect(service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any)).rejects.toBeInstanceOf(BadRequestException);

      usersRepo.findOne.mockResolvedValue(userRow());
      const result = await service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any);
      expect(result).toEqual({ status: 'queued' });
    });

    it('queues the user when nobody is waiting at that type+fee', async () => {
      wallet.assertBalance.mockResolvedValue(undefined);
      usersRepo.findOne.mockResolvedValue(userRow());

      const result = await service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any);

      expect(result).toEqual({ status: 'queued' });
    });

    it('pairs two waiting players at the same type+fee and starts the duel', async () => {
      wallet.assertBalance.mockResolvedValue(undefined);
      wallet.debit.mockResolvedValue(undefined as any);
      usersRepo.findOne
        .mockResolvedValueOnce(userRow({ id: 'user-1' }))
        .mockResolvedValueOnce(userRow({ id: 'user-2' }))
        .mockResolvedValueOnce(userRow({ id: 'user-1' }))
        .mockResolvedValueOnce(userRow({ id: 'user-2' }));
      tournamentsRepo.save.mockResolvedValue({ id: 'tourn-1' } as any);
      matches.createMatch.mockResolvedValue({ id: 'match-1' } as any);

      await service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any);
      const result = await service.joinDuelQueue('user-2', TournamentType.DUEL_FLASH, 6 as any);

      expect(result).toEqual({ status: 'matched', tournamentId: 'tourn-1', matchId: 'match-1' });
      expect(wallet.debit).toHaveBeenCalledTimes(2);
      expect(game.emitToUser).toHaveBeenCalledTimes(2);
    });

    it('refunds the first player and re-queues the opponent when the second debit fails', async () => {
      wallet.assertBalance.mockResolvedValue(undefined);
      wallet.debit
        .mockResolvedValueOnce(undefined as any) // white debit succeeds
        .mockRejectedValueOnce(new Error('insufficient funds')); // black debit fails
      wallet.credit.mockResolvedValue(undefined as any);
      usersRepo.findOne
        .mockResolvedValueOnce(userRow({ id: 'user-1' }))
        .mockResolvedValueOnce(userRow({ id: 'user-2' }));
      tournamentsRepo.save.mockResolvedValue({ id: 'tourn-1' } as any);
      tournamentsRepo.update.mockResolvedValue(undefined as any);

      await service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any);
      await expect(service.joinDuelQueue('user-2', TournamentType.DUEL_FLASH, 6 as any)).rejects.toBeInstanceOf(BadRequestException);

      expect(wallet.credit).toHaveBeenCalled();
      expect(tournamentsRepo.update).toHaveBeenCalledWith('tourn-1', { status: TournamentStatus.CANCELLED });

      // The opponent should be requeue-able / matchable again afterwards.
      wallet.debit.mockResolvedValue(undefined as any);
      usersRepo.findOne
        .mockResolvedValueOnce(userRow({ id: 'user-3' }))
        .mockResolvedValueOnce(userRow({ id: 'user-1' }))
        .mockResolvedValueOnce(userRow({ id: 'user-3' }));
      matches.createMatch.mockResolvedValue({ id: 'match-2' } as any);
      const rematch = await service.joinDuelQueue('user-3', TournamentType.DUEL_FLASH, 6 as any);
      expect(rematch).toEqual(expect.objectContaining({ status: 'matched' }));
    });

    it('logs and rethrows when loading player data for the match_found payload fails', async () => {
      wallet.assertBalance.mockResolvedValue(undefined);
      wallet.debit.mockResolvedValue(undefined as any);
      usersRepo.findOne
        .mockResolvedValueOnce(userRow({ id: 'user-1' }))
        .mockResolvedValueOnce(userRow({ id: 'user-2' }))
        .mockResolvedValueOnce(null) // white lookup for match_found fails
        .mockResolvedValueOnce(userRow({ id: 'user-2' }));
      tournamentsRepo.save.mockResolvedValue({ id: 'tourn-1' } as any);
      matches.createMatch.mockResolvedValue({ id: 'match-1' } as any);

      await service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any);
      await expect(service.joinDuelQueue('user-2', TournamentType.DUEL_FLASH, 6 as any)).rejects.toThrow();
    });
  });

  describe('leaveDuelQueue', () => {
    it('reports not_in_queue when the user was never queued', () => {
      expect(service.leaveDuelQueue('never-queued')).toEqual({ status: 'not_in_queue' });
    });

    it('removes the user from their duel queue', async () => {
      wallet.assertBalance.mockResolvedValue(undefined);
      usersRepo.findOne.mockResolvedValue(userRow());
      await service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any);

      const result = service.leaveDuelQueue('user-1');

      expect(result).toEqual({ status: 'left' });
      expect(service.leaveDuelQueue('user-1')).toEqual({ status: 'not_in_queue' });
    });
  });

  // ─── Challenges ─────────────────────────────────────────────────────────────

  describe('sendChallenge', () => {
    it('throws NotFoundException when the challenger does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.sendChallenge('ghost', 'target-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('emits a socket event and persists a notification for the challenged user', async () => {
      usersRepo.findOne.mockResolvedValue(userRow({ id: 'challenger-1', nickname: 'Bob', rating: 1300 }));

      const result = await service.sendChallenge('challenger-1', 'target-1');

      expect(game.emitToUser).toHaveBeenCalledWith('target-1', 'challenge_received', expect.objectContaining({
        challengerId: 'challenger-1', challengerNickname: 'Bob', challengerRating: 1300,
      }));
      expect(notifications.create).toHaveBeenCalled();
      expect(result).toEqual({ status: 'sent' });
    });
  });

  describe('acceptChallenge', () => {
    it('creates the match and notifies both players', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(userRow({ id: 'acceptor-1' }))
        .mockResolvedValueOnce(userRow({ id: 'challenger-1' }));
      matches.createMatch.mockResolvedValue({ id: 'match-1' } as any);

      const result = await service.acceptChallenge('acceptor-1', 'challenger-1');

      expect(result).toEqual({ status: 'matched', matchId: 'match-1' });
      expect(game.emitToUser).toHaveBeenCalledTimes(2);
    });
  });

  describe('denyChallenge', () => {
    it('notifies the original challenger that the challenge was rejected', async () => {
      usersRepo.findOne.mockResolvedValue(userRow({ id: 'denier-1', nickname: 'Carol' }));

      const result = await service.denyChallenge('denier-1', 'challenger-1');

      expect(game.emitToUser).toHaveBeenCalledWith('challenger-1', 'challenge_rejected', {
        challengedId: 'denier-1', challengedNickname: 'Carol',
      });
      expect(result).toEqual({ status: 'denied' });
    });

    it('tolerates a missing denier user record (nickname is undefined)', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.denyChallenge('denier-1', 'challenger-1');

      expect(game.emitToUser).toHaveBeenCalledWith('challenger-1', 'challenge_rejected', {
        challengedId: 'denier-1', challengedNickname: undefined,
      });
      expect(result).toEqual({ status: 'denied' });
    });
  });

  // ─── Queue sizes / active match ─────────────────────────────────────────────

  describe('getActiveMatch', () => {
    it('delegates to MatchesService', async () => {
      matches.getActiveMatchForUser.mockResolvedValue(null);
      await service.getActiveMatch('user-1');
      expect(matches.getActiveMatchForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getQueueSizes', () => {
    it('reports zero casual size and empty duel map when nothing is queued', () => {
      expect(service.getQueueSizes()).toEqual({ casual: 0, duel: {} });
    });

    it('counts humans in the casual queue plus available bot slots (capped at 3)', async () => {
      usersRepo.count.mockResolvedValue(5);
      usersRepo.find.mockResolvedValue([
        userRow({ id: 'bot-1', isBot: true }),
        userRow({ id: 'bot-2', isBot: true }),
        userRow({ id: 'bot-3', isBot: true }),
        userRow({ id: 'bot-4', isBot: true }),
      ]);
      await service.onModuleInit();
      usersRepo.findOne.mockResolvedValue(userRow({ id: 'user-1' }));
      await service.joinQueue('user-1');

      const result = service.getQueueSizes();

      expect(result.casual).toBe(1 + 3); // 1 human + capped bot slots
    });

    it('reports per-key duel queue sizes', async () => {
      wallet.assertBalance.mockResolvedValue(undefined);
      usersRepo.findOne.mockResolvedValue(userRow({ id: 'user-1' }));
      await service.joinDuelQueue('user-1', TournamentType.DUEL_FLASH, 6 as any);

      const result = service.getQueueSizes();

      expect(result.duel[`${TournamentType.DUEL_FLASH}:6`]).toBe(1);
    });
  });

  // ─── Bot injection (triggered by the periodic interval) ────────────────────

  describe('bot injection for long-waiting humans', () => {
    it('pairs a long-waiting human with the closest-rated available bot', async () => {
      jest.useFakeTimers();
      usersRepo.count.mockResolvedValue(1);
      usersRepo.find.mockResolvedValue([
        userRow({ id: 'bot-far', rating: 2000, nickname: 'FarBot' }),
        userRow({ id: 'bot-close', rating: 1210, nickname: 'CloseBot' }),
      ]);
      await service.onModuleInit();

      usersRepo.findOne.mockResolvedValue(userRow({ id: 'user-1', rating: 1200 }));
      await service.joinQueue('user-1');

      usersRepo.findOne
        .mockResolvedValueOnce(userRow({ id: 'user-1', rating: 1200 }))
        .mockResolvedValueOnce(userRow({ id: 'bot-close', rating: 1210, isBot: true }));
      matches.createMatch.mockResolvedValue({ id: 'match-1' } as any);

      await jest.advanceTimersByTimeAsync(18_000);

      expect(botService.markBotActive).toHaveBeenCalledWith('bot-close');
    });

    it('does nothing when there are no bots available to inject', async () => {
      jest.useFakeTimers();
      usersRepo.count.mockResolvedValue(1);
      usersRepo.find.mockResolvedValue([]);
      await service.onModuleInit();

      usersRepo.findOne.mockResolvedValue(userRow({ id: 'user-1' }));
      await service.joinQueue('user-1');

      await jest.advanceTimersByTimeAsync(18_000);

      expect(botService.markBotActive).not.toHaveBeenCalled();
    });

    it('marks the bot idle again if starting the casual match fails', async () => {
      jest.useFakeTimers();
      usersRepo.count.mockResolvedValue(1);
      usersRepo.find.mockResolvedValue([userRow({ id: 'bot-1', rating: 1200 })]);
      await service.onModuleInit();

      usersRepo.findOne.mockResolvedValue(userRow({ id: 'user-1', rating: 1200 }));
      await service.joinQueue('user-1');

      matches.createMatch.mockRejectedValue(new Error('db down'));
      usersRepo.findOne.mockResolvedValue(userRow({ id: 'user-1', rating: 1200 }));

      await jest.advanceTimersByTimeAsync(18_000);
      await Promise.resolve();
      await Promise.resolve();

      expect(botService.markBotIdle).toHaveBeenCalledWith('bot-1');
    });
  });
});
