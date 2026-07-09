import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformRevenueRepository } from './platform-revenue.repository';
import { PlatformRevenue } from './entities/platform-revenue.entity';

describe('PlatformRevenueRepository', () => {
  let repository: PlatformRevenueRepository;
  let ormRepo: jest.Mocked<Repository<PlatformRevenue>>;
  let qb: any;

  beforeEach(async () => {
    qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getRawOne: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        PlatformRevenueRepository,
        {
          provide: getRepositoryToken(PlatformRevenue),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findAndCount: jest.fn(),
            createQueryBuilder: jest.fn(() => qb),
          },
        },
      ],
    }).compile();

    repository = module.get(PlatformRevenueRepository);
    ormRepo = module.get(getRepositoryToken(PlatformRevenue));
  });

  describe('create', () => {
    it('delegates to the underlying repository', () => {
      const entity = { id: '1' } as PlatformRevenue;
      ormRepo.create.mockReturnValue(entity);
      const result = repository.create({ amountCc: '10.00' });
      expect(ormRepo.create).toHaveBeenCalledWith({ amountCc: '10.00' });
      expect(result).toBe(entity);
    });
  });

  describe('save', () => {
    it('delegates to the underlying repository', async () => {
      const entity = { id: '1' } as PlatformRevenue;
      ormRepo.save.mockResolvedValue(entity);
      const result = await repository.save(entity);
      expect(ormRepo.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
    });
  });

  describe('summaryByType', () => {
    it('groups by type and returns raw sums', async () => {
      qb.getRawMany.mockResolvedValue([{ type: 'RAKE_DUEL', totalCc: '100.00', count: '5' }]);
      const result = await repository.summaryByType();
      expect(ormRepo.createQueryBuilder).toHaveBeenCalledWith('r');
      expect(qb.groupBy).toHaveBeenCalledWith('r.type');
      expect(result).toEqual([{ type: 'RAKE_DUEL', totalCc: '100.00', count: '5' }]);
    });
  });

  describe('findAndCount', () => {
    it('paginates ordered by createdAt desc', async () => {
      ormRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await repository.findAndCount(2, 10);
      expect(ormRepo.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
      expect(result).toEqual([[], 0]);
    });
  });

  describe('chartByPeriod', () => {
    it('queries grouped daily totals since the given date', async () => {
      const since = new Date('2026-01-01');
      qb.getRawMany.mockResolvedValue([{ date: '2026-01-01', type: 'RAKE_DUEL', totalCc: '10' }]);
      const result = await repository.chartByPeriod(since);
      expect(qb.where).toHaveBeenCalledWith('r.created_at >= :since', { since });
      expect(result).toEqual([{ date: '2026-01-01', type: 'RAKE_DUEL', totalCc: '10' }]);
    });
  });

  describe('todayTotal', () => {
    it('sums revenue between the given start and end', async () => {
      const start = new Date('2026-01-01T00:00:00');
      const end = new Date('2026-01-01T23:59:59');
      qb.getRawOne.mockResolvedValue({ total: '42.00' });
      const result = await repository.todayTotal(start, end);
      expect(qb.where).toHaveBeenCalledWith('r.created_at BETWEEN :start AND :end', { start, end });
      expect(result).toEqual({ total: '42.00' });
    });

    it('returns undefined when there is no revenue for the period', async () => {
      qb.getRawOne.mockResolvedValue(undefined);
      const result = await repository.todayTotal(new Date(), new Date());
      expect(result).toBeUndefined();
    });
  });
});
