import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardController', () => {
  let controller: AdminDashboardController;
  let service: jest.Mocked<AdminDashboardService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [
        {
          provide: AdminDashboardService,
          useValue: { kpis: jest.fn(), topWinners: jest.fn(), alerts: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AdminDashboardController);
    service = module.get(AdminDashboardService);
  });

  describe('kpis', () => {
    it('returns the service result', async () => {
      service.kpis.mockResolvedValue({ newUsersToday: 5 } as any);
      const result = await controller.kpis();
      expect(result).toEqual({ newUsersToday: 5 });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.kpis.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.kpis()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.kpis.mockRejectedValue(new Error('db down'));
      await expect(controller.kpis()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.kpis.mockRejectedValue('plain string');
      await expect(controller.kpis()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('topWinners', () => {
    it('returns the service result', async () => {
      service.topWinners.mockResolvedValue([{ userId: 'u1' }] as any);
      const result = await controller.topWinners();
      expect(result).toEqual([{ userId: 'u1' }]);
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.topWinners.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.topWinners()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.topWinners.mockRejectedValue(new Error('boom'));
      await expect(controller.topWinners()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.topWinners.mockRejectedValue('plain string');
      await expect(controller.topWinners()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('alerts', () => {
    it('returns the service result', async () => {
      service.alerts.mockResolvedValue([]);
      const result = await controller.alerts();
      expect(result).toEqual([]);
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.alerts.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.alerts()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.alerts.mockRejectedValue(new Error('boom'));
      await expect(controller.alerts()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.alerts.mockRejectedValue('plain string');
      await expect(controller.alerts()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
