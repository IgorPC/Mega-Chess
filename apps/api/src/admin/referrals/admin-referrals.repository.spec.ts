import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminReferralsRepository } from './admin-referrals.repository';
import { Referral } from '../../referrals/entities/referral.entity';
import { ReferralEarning } from '../../referrals/entities/referral-earning.entity';

describe('AdminReferralsRepository', () => {
  let repository: AdminReferralsRepository;
  let referralRepo: jest.Mocked<Repository<Referral>>;
  let earningRepo: jest.Mocked<Repository<ReferralEarning>>;
  let qb: any;

  beforeEach(async () => {
    qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getCount: jest.fn(),
      getRawOne: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AdminReferralsRepository,
        {
          provide: getRepositoryToken(Referral),
          useValue: { createQueryBuilder: jest.fn(() => qb) },
        },
        {
          provide: getRepositoryToken(ReferralEarning),
          useValue: { createQueryBuilder: jest.fn(() => qb) },
        },
      ],
    }).compile();

    repository = module.get(AdminReferralsRepository);
    referralRepo = module.get(getRepositoryToken(Referral));
    earningRepo = module.get(getRepositoryToken(ReferralEarning));
  });

  describe('findPage', () => {
    it('builds the query and returns items with total', async () => {
      qb.getRawMany.mockResolvedValue([{ id: '1' }]);
      qb.getCount.mockResolvedValue(1);

      const result = await repository.findPage({ page: 1, limit: 25 });

      expect(result).toEqual({ items: [{ id: '1' }], total: 1 });
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('applies referrerId and isEligible filters when provided', async () => {
      qb.getRawMany.mockResolvedValue([]);
      qb.getCount.mockResolvedValue(0);

      await repository.findPage({ page: 2, limit: 10, referrerId: 'ref-1', isEligible: true });

      expect(qb.andWhere).toHaveBeenCalledWith('r.referrerId = :referrerId', { referrerId: 'ref-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('r.isEligible = :isEligible', { isEligible: true });
      expect(qb.offset).toHaveBeenCalledWith(10);
    });

    it('applies isEligible=false filter distinctly from undefined', async () => {
      qb.getRawMany.mockResolvedValue([]);
      qb.getCount.mockResolvedValue(0);

      await repository.findPage({ page: 1, limit: 25, isEligible: false });

      expect(qb.andWhere).toHaveBeenCalledWith('r.isEligible = :isEligible', { isEligible: false });
    });

    it('builds the totalEarned subquery passed to addSelect', async () => {
      qb.getRawMany.mockResolvedValue([]);
      qb.getCount.mockResolvedValue(0);

      await repository.findPage({ page: 1, limit: 25 });

      const subQueryBuilderFn = qb.addSelect.mock.calls[0][0];
      const subQb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
      };
      const result = subQueryBuilderFn(subQb);

      expect(subQb.select).toHaveBeenCalledWith('COALESCE(SUM(e.amount), 0)');
      expect(subQb.from).toHaveBeenCalledWith(ReferralEarning, 'e');
      expect(subQb.where).toHaveBeenCalledWith('e.referrerId = r.referrerId AND e.referredId = r.referredId');
      expect(result).toBe(subQb);
    });
  });

  describe('getEarningsStatsRaw', () => {
    it('returns raw stats without a since filter', async () => {
      qb.getRawOne.mockResolvedValue({ totalEarned: '10', totalPayments: '2' });
      const result = await repository.getEarningsStatsRaw();
      expect(qb.where).not.toHaveBeenCalled();
      expect(result).toEqual({ totalEarned: '10', totalPayments: '2' });
    });

    it('applies a since filter when provided', async () => {
      qb.getRawOne.mockResolvedValue({ totalEarned: '0', totalPayments: '0' });
      const since = new Date('2026-01-01');
      await repository.getEarningsStatsRaw(since);
      expect(qb.where).toHaveBeenCalledWith('e.createdAt >= :since', { since });
    });
  });
});
