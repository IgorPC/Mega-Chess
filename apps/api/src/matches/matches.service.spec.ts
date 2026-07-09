import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchesService } from './matches.service';
import { Match, MatchResult, MatchStatus, MatchTurn } from '../entities/match.entity';
import { User } from '../entities/user.entity';

describe('MatchesService', () => {
  let service: MatchesService;
  let matchesRepo: jest.Mocked<Repository<Match>>;
  let usersRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: getRepositoryToken(Match),
          useValue: {
            create: jest.fn((v) => v),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(MatchesService);
    matchesRepo = module.get(getRepositoryToken(Match));
    usersRepo = module.get(getRepositoryToken(User));
  });

  describe('createMatch', () => {
    it('creates an ongoing match seeded with both players current ratings', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'white-1', rating: 1200 } as User)
        .mockResolvedValueOnce({ id: 'black-1', rating: 1300 } as User);
      matchesRepo.save.mockResolvedValue({ id: 'match-1' } as Match);
      matchesRepo.findOne.mockResolvedValue({ id: 'match-1', whitePlayerId: 'white-1', blackPlayerId: 'black-1' } as Match);

      const result = await service.createMatch('white-1', 'black-1');

      expect(matchesRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        whitePlayerId: 'white-1', blackPlayerId: 'black-1',
        status: MatchStatus.ONGOING, whiteRatingBefore: 1200, blackRatingBefore: 1300,
      }));
      expect(matchesRepo.save).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: 'match-1' }));
    });
  });

  describe('createOfflineMatch', () => {
    it('creates a finished, offline match with no black player', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', rating: 1400 } as User);
      matchesRepo.save.mockResolvedValue({ id: 'offline-1' } as Match);

      const result = await service.createOfflineMatch('user-1', MatchResult.WHITE_WINS, 'medium', '1. e4', []);

      expect(matchesRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        whitePlayerId: 'user-1', blackPlayerId: null, isOffline: true,
        status: MatchStatus.FINISHED, aiDifficulty: 'medium', whiteRatingBefore: 1400,
      }));
      expect(result).toEqual({ id: 'offline-1' });
    });
  });

  describe('getActiveMatchForUser', () => {
    it('returns null when the user has no ongoing match', async () => {
      matchesRepo.findOne.mockResolvedValue(null);

      const result = await service.getActiveMatchForUser('user-1');

      expect(result).toBeNull();
    });

    it('returns the match with color=white when the user is the white player', async () => {
      matchesRepo.findOne.mockResolvedValue({
        id: 'm1', whitePlayerId: 'user-1', blackPlayerId: 'user-2',
        whitePlayer: { id: 'user-1', nickname: 'Alice', rating: 1200, avatarUrl: null },
        blackPlayer: { id: 'user-2', nickname: 'Bob', rating: 1250, avatarUrl: 'http://a' },
      } as any);

      const result = await service.getActiveMatchForUser('user-1');

      expect(result).toEqual({
        matchId: 'm1',
        color: 'white',
        whitePlayer: { id: 'user-1', nickname: 'Alice', rating: 1200, avatarUrl: null },
        blackPlayer: { id: 'user-2', nickname: 'Bob', rating: 1250, avatarUrl: 'http://a' },
      });
    });

    it('returns color=black when the user is the black player', async () => {
      matchesRepo.findOne.mockResolvedValue({
        id: 'm1', whitePlayerId: 'user-2', blackPlayerId: 'user-1',
        whitePlayer: { id: 'user-2', nickname: 'Bob', rating: 1250, avatarUrl: null },
        blackPlayer: { id: 'user-1', nickname: 'Alice', rating: 1200, avatarUrl: null },
      } as any);

      const result = await service.getActiveMatchForUser('user-1');

      expect(result?.color).toBe('black');
    });

    it('handles a missing player relation gracefully (returns null for that side)', async () => {
      matchesRepo.findOne.mockResolvedValue({
        id: 'm1', whitePlayerId: 'user-1', blackPlayerId: 'user-2',
        whitePlayer: undefined, blackPlayer: undefined,
      } as any);

      const result = await service.getActiveMatchForUser('user-1');

      expect(result).toEqual({ matchId: 'm1', color: 'white', whitePlayer: null, blackPlayer: null });
    });
  });

  describe('getMatch', () => {
    it('fetches the match with both player relations', async () => {
      matchesRepo.findOne.mockResolvedValue({ id: 'm1' } as Match);

      const result = await service.getMatch('m1');

      expect(matchesRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'm1' }, relations: ['whitePlayer', 'blackPlayer'],
      });
      expect(result).toEqual({ id: 'm1' });
    });

    it('returns null when the match does not exist', async () => {
      matchesRepo.findOne.mockResolvedValue(null);
      const result = await service.getMatch('missing');
      expect(result).toBeNull();
    });
  });

  describe('updateFen', () => {
    it('derives currentTurn=WHITE from a FEN with " w "', async () => {
      await service.updateFen('m1', 'rnbqkbnr/8/8/8/8/8/8/RNBQKBNR w KQkq - 0 1', 'pgn', []);
      expect(matchesRepo.update).toHaveBeenCalledWith('m1', expect.objectContaining({ currentTurn: MatchTurn.WHITE }));
    });

    it('derives currentTurn=BLACK from a FEN with " b "', async () => {
      await service.updateFen('m1', 'rnbqkbnr/8/8/8/8/8/8/RNBQKBNR b KQkq - 0 1', 'pgn', []);
      expect(matchesRepo.update).toHaveBeenCalledWith('m1', expect.objectContaining({ currentTurn: MatchTurn.BLACK }));
    });
  });

  describe('finishMatch', () => {
    it('does nothing when the match does not exist', async () => {
      matchesRepo.findOne.mockResolvedValue(null);
      await service.finishMatch('missing', MatchResult.DRAW);
      expect(matchesRepo.update).not.toHaveBeenCalled();
    });

    it('skips ELO calculation for an offline match', async () => {
      matchesRepo.findOne.mockResolvedValue({ id: 'm1', isOffline: true } as Match);

      await service.finishMatch('m1', MatchResult.WHITE_WINS);

      expect(usersRepo.update).not.toHaveBeenCalled();
      expect(matchesRepo.update).toHaveBeenCalledWith('m1', expect.objectContaining({
        status: MatchStatus.FINISHED, result: MatchResult.WHITE_WINS,
      }));
    });

    it('skips ELO calculation when there is no black player relation', async () => {
      matchesRepo.findOne.mockResolvedValue({ id: 'm1', isOffline: false, blackPlayer: null } as any);

      await service.finishMatch('m1', MatchResult.WHITE_WINS);

      expect(usersRepo.update).not.toHaveBeenCalled();
    });

    it('increases the winner rating and decreases the loser rating on WHITE_WINS', async () => {
      matchesRepo.findOne.mockResolvedValue({
        id: 'm1', isOffline: false,
        whitePlayerId: 'white-1', blackPlayerId: 'black-1',
        whitePlayer: { rating: 1200 }, blackPlayer: { rating: 1200 },
      } as any);

      await service.finishMatch('m1', MatchResult.WHITE_WINS);

      const [, whiteUpdate] = usersRepo.update.mock.calls.find(c => c[0] === 'white-1')!;
      const [, blackUpdate] = usersRepo.update.mock.calls.find(c => c[0] === 'black-1')!;
      expect((whiteUpdate as any).rating).toBeGreaterThan(1200);
      expect((blackUpdate as any).rating).toBeLessThan(1200);
    });

    it('treats FORFEIT_BLACK the same as a white win for rating purposes', async () => {
      matchesRepo.findOne.mockResolvedValue({
        id: 'm1', isOffline: false,
        whitePlayerId: 'white-1', blackPlayerId: 'black-1',
        whitePlayer: { rating: 1200 }, blackPlayer: { rating: 1200 },
      } as any);

      await service.finishMatch('m1', MatchResult.FORFEIT_BLACK);

      const [, whiteUpdate] = usersRepo.update.mock.calls.find(c => c[0] === 'white-1')!;
      expect((whiteUpdate as any).rating).toBeGreaterThan(1200);
    });

    it('increases the black player rating and decreases white on BLACK_WINS', async () => {
      matchesRepo.findOne.mockResolvedValue({
        id: 'm1', isOffline: false,
        whitePlayerId: 'white-1', blackPlayerId: 'black-1',
        whitePlayer: { rating: 1200 }, blackPlayer: { rating: 1200 },
      } as any);

      await service.finishMatch('m1', MatchResult.BLACK_WINS);

      const [, whiteUpdate] = usersRepo.update.mock.calls.find(c => c[0] === 'white-1')!;
      const [, blackUpdate] = usersRepo.update.mock.calls.find(c => c[0] === 'black-1')!;
      expect((whiteUpdate as any).rating).toBeLessThan(1200);
      expect((blackUpdate as any).rating).toBeGreaterThan(1200);
    });

    it('keeps both ratings roughly equal on a DRAW between equally-rated players', async () => {
      matchesRepo.findOne.mockResolvedValue({
        id: 'm1', isOffline: false,
        whitePlayerId: 'white-1', blackPlayerId: 'black-1',
        whitePlayer: { rating: 1200 }, blackPlayer: { rating: 1200 },
      } as any);

      await service.finishMatch('m1', MatchResult.DRAW);

      const [, whiteUpdate] = usersRepo.update.mock.calls.find(c => c[0] === 'white-1')!;
      const [, blackUpdate] = usersRepo.update.mock.calls.find(c => c[0] === 'black-1')!;
      expect((whiteUpdate as any).rating).toBe(1200);
      expect((blackUpdate as any).rating).toBe(1200);
    });

    it('persists whiteRatingAfter/blackRatingAfter and marks the match finished', async () => {
      matchesRepo.findOne.mockResolvedValue({
        id: 'm1', isOffline: false,
        whitePlayerId: 'white-1', blackPlayerId: 'black-1',
        whitePlayer: { rating: 1200 }, blackPlayer: { rating: 1200 },
      } as any);

      await service.finishMatch('m1', MatchResult.WHITE_WINS);

      const matchUpdateCall = matchesRepo.update.mock.calls.find(c => c[0] === 'm1')!;
      expect(matchUpdateCall[1]).toEqual(expect.objectContaining({
        status: MatchStatus.FINISHED,
        result: MatchResult.WHITE_WINS,
        whiteRatingAfter: expect.any(Number),
        blackRatingAfter: expect.any(Number),
      }));
    });
  });
});
