import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { RankingRepository } from './ranking.repository';
import { User } from '../entities/user.entity';

describe('RankingRepository', () => {
  let repository: RankingRepository;
  let ormRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RankingRepository,
        {
          provide: getRepositoryToken(User),
          useValue: { find: jest.fn(), findOne: jest.fn(), count: jest.fn() },
        },
      ],
    }).compile();

    repository = module.get(RankingRepository);
    ormRepo = module.get(getRepositoryToken(User));
  });

  describe('findTopByRating', () => {
    it('queries ordered by rating desc with the given limit', async () => {
      ormRepo.find.mockResolvedValue([]);
      await repository.findTopByRating(10);
      expect(ormRepo.find).toHaveBeenCalledWith({
        select: ['id', 'name', 'nickname', 'avatarUrl', 'rating'],
        order: { rating: 'DESC' },
        take: 10,
      });
    });

    it('returns an empty array when there are no users', async () => {
      ormRepo.find.mockResolvedValue([]);
      const result = await repository.findTopByRating(10);
      expect(result).toEqual([]);
    });
  });

  describe('findRating', () => {
    it('returns null when the user does not exist', async () => {
      ormRepo.findOne.mockResolvedValue(null);
      const result = await repository.findRating('missing');
      expect(result).toBeNull();
    });

    it('selects only the rating field', async () => {
      ormRepo.findOne.mockResolvedValue({ rating: 1500 } as any);
      await repository.findRating('user-1');
      expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' }, select: ['rating'] });
    });
  });

  describe('countAboveRating', () => {
    it('counts users with rating strictly greater than the given value', async () => {
      ormRepo.count.mockResolvedValue(7);
      const result = await repository.countAboveRating(1000);
      expect(ormRepo.count).toHaveBeenCalledWith({ where: { rating: MoreThanOrEqual(1001) } });
      expect(result).toBe(7);
    });

    it('returns 0 when no one is rated higher', async () => {
      ormRepo.count.mockResolvedValue(0);
      const result = await repository.countAboveRating(9999);
      expect(result).toBe(0);
    });
  });
});
