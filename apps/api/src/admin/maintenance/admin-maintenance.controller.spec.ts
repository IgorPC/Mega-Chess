import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminMaintenanceController } from './admin-maintenance.controller';
import { AdminMaintenanceService } from './admin-maintenance.service';

describe('AdminMaintenanceController', () => {
  let controller: AdminMaintenanceController;
  let svc: jest.Mocked<AdminMaintenanceService>;
  const admin = { id: 'admin-1' } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminMaintenanceController],
      providers: [
        {
          provide: AdminMaintenanceService,
          useValue: {
            metrics: jest.fn(), logs: jest.fn(), getConfig: jest.fn(),
            updateConfig: jest.fn(), asaasStatus: jest.fn(), broadcast: jest.fn(),
            flushRedis: jest.fn(), aiUsageLogs: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AdminMaintenanceController);
    svc = module.get(AdminMaintenanceService);
  });

  describe('metrics', () => {
    it('delegates to service', async () => {
      svc.metrics.mockResolvedValue({ cpuUsage: 0.5 } as any);
      expect(await controller.metrics()).toEqual({ cpuUsage: 0.5 });
    });
    it('wraps error as 500', async () => {
      svc.metrics.mockRejectedValue(new Error('boom'));
      await expect(controller.metrics()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('wraps a non-Error rejection as 500', async () => {
      svc.metrics.mockRejectedValue('plain string');
      await expect(controller.metrics()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('rethrows a known HttpException unchanged', async () => {
      svc.metrics.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.metrics()).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('logs', () => {
    it('delegates with parsed limit', async () => {
      svc.logs.mockResolvedValue([]);
      expect(await controller.logs('100')).toEqual([]);
      expect(svc.logs).toHaveBeenCalledWith(100);
    });
    it('wraps error as 500', async () => {
      svc.logs.mockRejectedValue(new Error('boom'));
      await expect(controller.logs()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('wraps a non-Error rejection as 500', async () => {
      svc.logs.mockRejectedValue('plain string');
      await expect(controller.logs()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('rethrows a known HttpException unchanged', async () => {
      svc.logs.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.logs()).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('config', () => {
    it('delegates to getConfig', async () => {
      svc.getConfig.mockResolvedValue({ maintenanceMode: false });
      expect(await controller.config()).toEqual({ maintenanceMode: false });
    });
    it('wraps error as 500', async () => {
      svc.getConfig.mockRejectedValue(new Error('boom'));
      await expect(controller.config()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('wraps a non-Error rejection as 500', async () => {
      svc.getConfig.mockRejectedValue('plain string');
      await expect(controller.config()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('rethrows a known HttpException unchanged', async () => {
      svc.getConfig.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.config()).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateConfig', () => {
    it('delegates to service', async () => {
      svc.updateConfig.mockResolvedValue(undefined);
      await controller.updateConfig({ x: true }, admin);
      expect(svc.updateConfig).toHaveBeenCalledWith({ x: true }, admin);
    });
    it('wraps error as 500', async () => {
      svc.updateConfig.mockRejectedValue(new Error('boom'));
      await expect(controller.updateConfig({}, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('wraps a non-Error rejection as 500', async () => {
      svc.updateConfig.mockRejectedValue('plain string');
      await expect(controller.updateConfig({}, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('rethrows a known HttpException unchanged', async () => {
      svc.updateConfig.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.updateConfig({}, admin)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('asaasStatus', () => {
    it('delegates to service', async () => {
      svc.asaasStatus.mockResolvedValue({ ok: true, latencyMs: 50 });
      expect(await controller.asaasStatus()).toEqual({ ok: true, latencyMs: 50 });
    });
    it('wraps error as 500', async () => {
      svc.asaasStatus.mockRejectedValue(new Error('boom'));
      await expect(controller.asaasStatus()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('wraps a non-Error rejection as 500', async () => {
      svc.asaasStatus.mockRejectedValue('plain string');
      await expect(controller.asaasStatus()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('rethrows a known HttpException unchanged', async () => {
      svc.asaasStatus.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.asaasStatus()).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('broadcast', () => {
    it('delegates to service', async () => {
      svc.broadcast.mockResolvedValue(undefined);
      await controller.broadcast({ message: 'Hi', type: 'info' });
      expect(svc.broadcast).toHaveBeenCalledWith('Hi', 'info');
    });
    it('wraps error as 500', async () => {
      svc.broadcast.mockRejectedValue(new Error('boom'));
      await expect(controller.broadcast({ message: '', type: '' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('wraps a non-Error rejection as 500', async () => {
      svc.broadcast.mockRejectedValue('plain string');
      await expect(controller.broadcast({ message: '', type: '' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('rethrows a known HttpException unchanged', async () => {
      svc.broadcast.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.broadcast({ message: '', type: '' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('flushRedis', () => {
    it('delegates to service', async () => {
      svc.flushRedis.mockResolvedValue(undefined);
      await controller.flushRedis();
      expect(svc.flushRedis).toHaveBeenCalled();
    });
    it('wraps error as 500', async () => {
      svc.flushRedis.mockRejectedValue(new Error('boom'));
      await expect(controller.flushRedis()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('wraps a non-Error rejection as 500', async () => {
      svc.flushRedis.mockRejectedValue('plain string');
      await expect(controller.flushRedis()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('rethrows a known HttpException unchanged', async () => {
      svc.flushRedis.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.flushRedis()).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('aiUsage', () => {
    it('delegates with parsed params', async () => {
      svc.aiUsageLogs.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      await controller.aiUsage('2', '10');
      expect(svc.aiUsageLogs).toHaveBeenCalledWith(2, 10);
    });
    it('wraps error as 500', async () => {
      svc.aiUsageLogs.mockRejectedValue(new Error('boom'));
      await expect(controller.aiUsage()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('wraps a non-Error rejection as 500', async () => {
      svc.aiUsageLogs.mockRejectedValue('plain string');
      await expect(controller.aiUsage()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('rethrows a known HttpException unchanged', async () => {
      svc.aiUsageLogs.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.aiUsage()).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
