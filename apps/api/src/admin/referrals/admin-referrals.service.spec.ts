import { Test } from '@nestjs/testing';
import { AdminReferralsService } from './admin-referrals.service';
import { AdminReferralsRepository } from './admin-referrals.repository';

describe('AdminReferralsService', () => {
  let service: AdminReferralsService;
  let repo: jest.Mocked<AdminReferralsRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminReferralsService,
        {
          provide: AdminReferralsRepository,
          useValue: { findPage: jest.fn(), getEarningsStatsRaw: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AdminReferralsService);
    repo = module.get(AdminReferralsRepository);
  });

  describe('list', () => {
    it('maps rows and computes pagination metadata', async () => {
      repo.findPage.mockResolvedValue({
        items: [
          {
            id: '1',
            referrerId: 'r1',
            referrerNickname: 'Alice',
            referredId: 'r2',
            referredNickname: 'Bob',
            isEligible: true,
            createdAt: new Date('2026-01-01'),
            totalEarned: '5.50',
          },
        ],
        total: 3,
      });

      const result = await service.list({ page: 1, limit: 2 });

      expect(result.items).toEqual([
        {
          id: '1',
          referrerId: 'r1',
          referrerNickname: 'Alice',
          referredId: 'r2',
          referredNickname: 'Bob',
          isEligible: true,
          createdAt: new Date('2026-01-01'),
          totalEarned: 5.5,
        },
      ]);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
    });

    it('falls back to "?" for missing nicknames and 0 for missing earnings', async () => {
      repo.findPage.mockResolvedValue({
        items: [
          {
            id: '1',
            referrerId: 'r1',
            referrerNickname: null,
            referredId: 'r2',
            referredNickname: null,
            isEligible: false,
            createdAt: new Date('2026-01-01'),
            totalEarned: null,
          },
        ],
        total: 1,
      });

      const result = await service.list({ page: 1, limit: 25 });

      expect(result.items[0].referrerNickname).toBe('?');
      expect(result.items[0].referredNickname).toBe('?');
      expect(result.items[0].totalEarned).toBe(0);
    });

    it('returns empty items when there are none', async () => {
      repo.findPage.mockResolvedValue({ items: [], total: 0 });
      const result = await service.list({ page: 1, limit: 25 });
      expect(result.items).toEqual([]);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('stats', () => {
    it('queries without a since filter when period is undefined', async () => {
      repo.getEarningsStatsRaw.mockResolvedValue({ totalEarned: '100', totalPayments: '4' });
      const result = await service.stats(undefined);
      expect(repo.getEarningsStatsRaw).toHaveBeenCalledWith(undefined);
      expect(result).toEqual({ totalEarned: 100, totalPayments: 4 });
    });

    it('queries without a since filter when period is "all"', async () => {
      repo.getEarningsStatsRaw.mockResolvedValue({ totalEarned: '0', totalPayments: '0' });
      await service.stats('all');
      expect(repo.getEarningsStatsRaw).toHaveBeenCalledWith(undefined);
    });

    it('computes a since date for a known period bucket', async () => {
      repo.getEarningsStatsRaw.mockResolvedValue({ totalEarned: '0', totalPayments: '0' });
      await service.stats('7d');
      const sinceArg = repo.getEarningsStatsRaw.mock.calls[0][0];
      expect(sinceArg).toBeInstanceOf(Date);
    });

    it('ignores an unknown period bucket and queries without a since filter', async () => {
      repo.getEarningsStatsRaw.mockResolvedValue({ totalEarned: '0', totalPayments: '0' });
      await service.stats('unknown-period');
      expect(repo.getEarningsStatsRaw).toHaveBeenCalledWith(undefined);
    });

    it('defaults totals to 0 when the repository returns undefined', async () => {
      repo.getEarningsStatsRaw.mockResolvedValue(undefined);
      const result = await service.stats();
      expect(result).toEqual({ totalEarned: 0, totalPayments: 0 });
    });
  });
});
