import { Test } from '@nestjs/testing';
import { RankingService } from './ranking.service';
import { RankingRepository } from './ranking.repository';

describe('RankingService', () => {
  let service: RankingService;
  let repo: jest.Mocked<RankingRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RankingService,
        {
          provide: RankingRepository,
          useValue: {
            findTopByRating: jest.fn(),
            findRating: jest.fn(),
            countAboveRating: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(RankingService);
    repo = module.get(RankingRepository);
  });

  describe('getTopPlayers', () => {
    it('delegates to the repository with the default limit', async () => {
      repo.findTopByRating.mockResolvedValue([]);
      await service.getTopPlayers('week');
      expect(repo.findTopByRating).toHaveBeenCalledWith(expect.any(Number));
    });

    it('passes through an explicit limit', async () => {
      repo.findTopByRating.mockResolvedValue([]);
      await service.getTopPlayers('week', 5);
      expect(repo.findTopByRating).toHaveBeenCalledWith(5);
    });
  });

  describe('getUserRank', () => {
    it('returns null when the user does not exist', async () => {
      repo.findRating.mockResolvedValue(null);
      const result = await service.getUserRank('missing-id');
      expect(result).toBeNull();
      expect(repo.countAboveRating).not.toHaveBeenCalled();
    });

    it('computes position as 1-indexed count of higher-rated players + 1', async () => {
      repo.findRating.mockResolvedValue({ rating: 1200 } as any);
      repo.countAboveRating.mockResolvedValue(4);
      const result = await service.getUserRank('some-id');
      expect(result).toEqual({ position: 5, rating: 1200 });
      expect(repo.countAboveRating).toHaveBeenCalledWith(1200);
    });

    it('returns position 1 for the top-rated player (no one above)', async () => {
      repo.findRating.mockResolvedValue({ rating: 3000 } as any);
      repo.countAboveRating.mockResolvedValue(0);
      const result = await service.getUserRank('top-id');
      expect(result).toEqual({ position: 1, rating: 3000 });
    });
  });
});
