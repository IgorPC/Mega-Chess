import { Test } from '@nestjs/testing';
import { AdminMaintenanceService } from './admin-maintenance.service';
import { AdminMaintenanceRepository } from './admin-maintenance.repository';
import { PlatformConfigService } from '../../platform-config/platform-config.service';
import { AdminAuditService } from '../admin-audit.service';

describe('AdminMaintenanceService', () => {
  let service: AdminMaintenanceService;
  let repo: jest.Mocked<AdminMaintenanceRepository>;
  let platformConfig: jest.Mocked<PlatformConfigService>;
  let audit: jest.Mocked<AdminAuditService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminMaintenanceService,
        {
          provide: AdminMaintenanceRepository,
          useValue: { getDbSizeBytes: jest.fn(), findAllConfig: jest.fn(), findAndCountAiUsageLogs: jest.fn() },
        },
        { provide: PlatformConfigService, useValue: { set: jest.fn() } },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminMaintenanceService);
    repo = module.get(AdminMaintenanceRepository);
    platformConfig = module.get(PlatformConfigService);
    audit = module.get(AdminAuditService);
  });

  describe('setters', () => {
    it('tracks activeGames and wsConnections', async () => {
      service.setActiveGames(5);
      service.setWsConnections(10);
      service.incrementRequests();
      service.incrementErrors();

      repo.getDbSizeBytes.mockResolvedValue(1024 * 1024 * 50);
      const m = await service.metrics();
      expect(m.activeGames).toBe(5);
      expect(m.wsConnections).toBe(10);
      expect(m.dbSizeMb).toBe(50);
      expect(m.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('metrics', () => {
    it('returns app metrics', async () => {
      repo.getDbSizeBytes.mockResolvedValue(0);
      const m = await service.metrics();
      expect(m).toHaveProperty('cpuUsage');
      expect(m).toHaveProperty('memoryUsageMb');
      expect(m).toHaveProperty('requestsPerSecond');
      expect(m.requestsHistory).toBeNull();
    });
  });

  describe('logs', () => {
    it('returns empty array', async () => {
      expect(await service.logs()).toEqual([]);
    });
  });

  describe('getConfig', () => {
    it('converts false string to boolean false', async () => {
      repo.findAllConfig.mockResolvedValue([{ key: 'x', value: 'false' }] as any);
      const result = await service.getConfig();
      expect(result['x']).toBe(false);
    });

    it('converts true string to boolean true', async () => {
      repo.findAllConfig.mockResolvedValue([{ key: 'x', value: 'true' }] as any);
      const result = await service.getConfig();
      expect(result['x']).toBe(true);
    });

    it('converts a numeric string to a number', async () => {
      repo.findAllConfig.mockResolvedValue([{ key: 'fee', value: '0.05' }] as any);
      const result = await service.getConfig();
      expect(result['fee']).toBe(0.05);
    });

    it('keeps an empty string as-is instead of converting to number', async () => {
      repo.findAllConfig.mockResolvedValue([{ key: 'x', value: '' }] as any);
      const result = await service.getConfig();
      expect(result['x']).toBe('');
    });

    it('keeps a non-numeric, non-boolean string as-is', async () => {
      repo.findAllConfig.mockResolvedValue([{ key: 'x', value: 'hello' }] as any);
      const result = await service.getConfig();
      expect(result['x']).toBe('hello');
    });
  });

  describe('updateConfig', () => {
    it('sets each config key and logs audit', async () => {
      const admin = { id: 'a1', name: 'Admin' } as any;
      await service.updateConfig({ maintenanceMode: true, fee: 0.02 }, admin);
      expect(platformConfig.set).toHaveBeenCalledTimes(2);
      expect(audit.log).toHaveBeenCalledWith(admin, 'CONFIG_UPDATED', expect.anything());
    });
  });

  describe('asaasStatus', () => {
    it('returns ok and latency on success', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as any);
      const result = await service.asaasStatus();
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      (global.fetch as jest.Mock).mockRestore();
    });

    it('returns ok=false on failure', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'));
      const result = await service.asaasStatus();
      expect(result.ok).toBe(false);
      (global.fetch as jest.Mock).mockRestore();
    });
  });

  describe('broadcast', () => {
    it('emits admin:broadcast event', async () => {
      const spy = jest.spyOn(process as any, 'emit');
      await service.broadcast('Hello', 'info');
      expect(spy).toHaveBeenCalledWith('admin:broadcast', { message: 'Hello', type: 'info' });
      spy.mockRestore();
    });
  });

  describe('flushRedis', () => {
    it('emits admin:redis_flush event', async () => {
      const spy = jest.spyOn(process as any, 'emit');
      await service.flushRedis();
      expect(spy).toHaveBeenCalledWith('admin:redis_flush', {});
      spy.mockRestore();
    });
  });

  describe('aiUsageLogs', () => {
    it('returns paginated AI usage logs', async () => {
      repo.findAndCountAiUsageLogs.mockResolvedValue({ data: [{ id: 'l1' }], total: 30 } as any);
      const result = await service.aiUsageLogs(2, 10);
      expect(result).toEqual({ data: [{ id: 'l1' }], total: 30, page: 2, totalPages: 3 });
    });
  });
});
