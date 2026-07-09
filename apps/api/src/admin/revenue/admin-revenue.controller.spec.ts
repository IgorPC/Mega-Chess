import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRevenueController } from './admin-revenue.controller';
import { PlatformRevenueService } from '../../platform-revenue/platform-revenue.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';

describe('AdminRevenueController', () => {
  let controller: AdminRevenueController;
  let revenue: jest.Mocked<PlatformRevenueService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminRevenueController],
      providers: [
        {
          provide: PlatformRevenueService,
          useValue: { summary: jest.fn(), history: jest.fn(), chartByPeriod: jest.fn() },
        },
      ],
    })
      .overrideGuard(AdminJwtGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminRevenueController);
    revenue = module.get(PlatformRevenueService);
  });

  describe('summary', () => {
    it('delegates to the revenue service', async () => {
      revenue.summary.mockResolvedValue({ total: 100 } as any);
      const result = await controller.summary();
      expect(revenue.summary).toHaveBeenCalled();
      expect(result).toEqual({ total: 100 });
    });

    it('rethrows a known HttpException unchanged', async () => {
      revenue.summary.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.summary()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      revenue.summary.mockRejectedValue(new Error('db down'));
      await expect(controller.summary()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      revenue.summary.mockRejectedValue('raw string failure');
      await expect(controller.summary()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('history', () => {
    it('parses page and limit as numbers', async () => {
      revenue.history.mockResolvedValue({ data: [], total: 0 } as any);
      await controller.history('2' as any, '10' as any);
      expect(revenue.history).toHaveBeenCalledWith(2, 10);
    });

    it('applies defaults when not provided', async () => {
      revenue.history.mockResolvedValue({ data: [], total: 0 } as any);
      await controller.history(undefined as any, undefined as any);

      expect(revenue.history).toHaveBeenCalledWith(1, 50);
    });

    it('rethrows a known HttpException unchanged', async () => {
      revenue.history.mockRejectedValue(new NotFoundException());
      await expect(controller.history(undefined as any, undefined as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      revenue.history.mockRejectedValue(new Error('boom'));
      await expect(controller.history(undefined as any, undefined as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('chart', () => {
    it('parses days as a number', async () => {
      revenue.chartByPeriod.mockResolvedValue([] as any);
      await controller.chart('7' as any);
      expect(revenue.chartByPeriod).toHaveBeenCalledWith(7);
    });

    it('rethrows a known HttpException unchanged', async () => {
      revenue.chartByPeriod.mockRejectedValue(new NotFoundException());
      await expect(controller.chart(undefined as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      revenue.chartByPeriod.mockRejectedValue(new Error('boom'));
      await expect(controller.chart(undefined as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
