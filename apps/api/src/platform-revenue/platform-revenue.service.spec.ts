import { Test } from '@nestjs/testing';
import { PlatformRevenueService } from './platform-revenue.service';
import { PlatformRevenueRepository } from './platform-revenue.repository';
import { PlatformRevenueType } from './entities/platform-revenue.entity';

describe('PlatformRevenueService', () => {
  let service: PlatformRevenueService;
  let repo: jest.Mocked<PlatformRevenueRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PlatformRevenueService,
        {
          provide: PlatformRevenueRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            summaryByType: jest.fn(),
            findAndCount: jest.fn(),
            chartByPeriod: jest.fn(),
            todayTotal: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PlatformRevenueService);
    repo = module.get(PlatformRevenueRepository);
  });

  describe('record', () => {
    it('creates and saves a revenue entry with amount fixed to 2 decimals', () => {
      const entity = { id: '1' } as any;
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      service.record(PlatformRevenueType.RAKE_DUEL, 12.345, 'ref-1', 'desc');

      expect(repo.create).toHaveBeenCalledWith({
        type: PlatformRevenueType.RAKE_DUEL,
        amountCc: '12.35',
        referenceId: 'ref-1',
        description: 'desc',
      });
      expect(repo.save).toHaveBeenCalledWith(entity);
    });

    it('defaults description to null when omitted', () => {
      const entity = { id: '1' } as any;
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      service.record(PlatformRevenueType.WITHDRAWAL_FEE, 5, 'ref-2');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      );
    });

    it('does nothing when amount is zero or negative', () => {
      service.record(PlatformRevenueType.RAKE_DUEL, 0, 'ref-1');
      service.record(PlatformRevenueType.RAKE_DUEL, -5, 'ref-1');
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('swallows a save failure without throwing (fire-and-forget)', async () => {
      const entity = { id: '1' } as any;
      repo.create.mockReturnValue(entity);
      repo.save.mockRejectedValue(new Error('db down'));

      expect(() => service.record(PlatformRevenueType.RAKE_DUEL, 10, 'ref-1')).not.toThrow();
      await new Promise((r) => setImmediate(r));
    });
  });

  describe('summary', () => {
    it('aggregates totals by type', async () => {
      repo.summaryByType.mockResolvedValue([
        { type: 'RAKE_DUEL', totalCc: '100.00', count: '5' },
        { type: 'WITHDRAWAL_FEE', totalCc: '25.50', count: '3' },
      ]);

      const result = await service.summary();

      expect(result.totalCc).toBeCloseTo(125.5);
      expect(result.byType).toEqual({
        RAKE_DUEL: { totalCc: 100, count: 5 },
        WITHDRAWAL_FEE: { totalCc: 25.5, count: 3 },
      });
    });

    it('handles empty rows', async () => {
      repo.summaryByType.mockResolvedValue([]);
      const result = await service.summary();
      expect(result).toEqual({ totalCc: 0, byType: {} });
    });

    it('handles rows with null totalCc', async () => {
      repo.summaryByType.mockResolvedValue([{ type: 'RAKE_DUEL', totalCc: null as any, count: '0' }]);
      const result = await service.summary();
      expect(result.totalCc).toBe(0);
      expect(result.byType.RAKE_DUEL.totalCc).toBe(0);
    });
  });

  describe('history', () => {
    it('paginates results and computes totalPages', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: '1' } as any], 120]);
      const result = await service.history(2, 50);
      expect(repo.findAndCount).toHaveBeenCalledWith(2, 50);
      expect(result).toEqual({ items: [{ id: '1' }], total: 120, page: 2, totalPages: 3 });
    });

    it('applies default page and limit', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      await service.history();
      expect(repo.findAndCount).toHaveBeenCalledWith(1, 50);
    });
  });

  describe('chartByPeriod', () => {
    it('maps rows to date/type/totalCc using the default period', async () => {
      repo.chartByPeriod.mockResolvedValue([
        { date: '2026-01-01T00:00:00.000Z', type: 'RAKE_DUEL', totalCc: '10.5' },
      ]);
      const result = await service.chartByPeriod();
      expect(result).toEqual([{ date: '2026-01-01', type: 'RAKE_DUEL', totalCc: 10.5 }]);
      expect(repo.chartByPeriod).toHaveBeenCalledWith(expect.any(Date));
    });

    it('handles a null totalCc as 0', async () => {
      repo.chartByPeriod.mockResolvedValue([{ date: '2026-01-01T00:00:00.000Z', type: 'RAKE_DUEL', totalCc: null as any }]);
      const result = await service.chartByPeriod(7);
      expect(result[0].totalCc).toBe(0);
    });
  });

  describe('todayTotal', () => {
    it('parses the total from the repository', async () => {
      repo.todayTotal.mockResolvedValue({ total: '55.25' });
      const result = await service.todayTotal();
      expect(result).toBe(55.25);
    });

    it('returns 0 when there is no revenue today', async () => {
      repo.todayTotal.mockResolvedValue(undefined);
      const result = await service.todayTotal();
      expect(result).toBe(0);
    });
  });
});
