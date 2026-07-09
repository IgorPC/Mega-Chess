import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminMaintenanceRepository } from './admin-maintenance.repository';
import { AiUsageLog } from '../../entities/ai-usage-log.entity';
import { PlatformConfig } from '../../platform-config/entities/platform-config.entity';

describe('AdminMaintenanceRepository', () => {
  let repository: AdminMaintenanceRepository;
  let aiLogs: jest.Mocked<Repository<AiUsageLog>>;
  let cfgRepo: jest.Mocked<Repository<PlatformConfig>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminMaintenanceRepository,
        {
          provide: getRepositoryToken(AiUsageLog),
          useValue: { findAndCount: jest.fn() },
        },
        {
          provide: getRepositoryToken(PlatformConfig),
          useValue: { find: jest.fn(), manager: { query: jest.fn() } },
        },
      ],
    }).compile();

    repository = module.get(AdminMaintenanceRepository);
    aiLogs = module.get(getRepositoryToken(AiUsageLog));
    cfgRepo = module.get(getRepositoryToken(PlatformConfig));
  });

  describe('getDbSizeBytes', () => {
    it('parses the pg_database_size result', async () => {
      (cfgRepo.manager.query as jest.Mock).mockResolvedValue([{ size: '123456' }]);
      const result = await repository.getDbSizeBytes();
      expect(result).toBe(123456);
    });

    it('defaults to 0 when the query returns no rows', async () => {
      (cfgRepo.manager.query as jest.Mock).mockResolvedValue([]);
      const result = await repository.getDbSizeBytes();
      expect(result).toBe(0);
    });
  });

  describe('findAllConfig', () => {
    it('returns all platform config rows', async () => {
      cfgRepo.find.mockResolvedValue([{ key: 'maintenance_mode', value: 'true' }] as any);
      const result = await repository.findAllConfig();
      expect(result).toEqual([{ key: 'maintenance_mode', value: 'true' }]);
    });
  });

  describe('findAndCountAiUsageLogs', () => {
    it('paginates ai usage logs ordered by newest first', async () => {
      aiLogs.findAndCount.mockResolvedValue([[{ id: '1' }] as any, 1]);

      const result = await repository.findAndCountAiUsageLogs(2, 10);

      expect(aiLogs.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
      expect(result).toEqual({ data: [{ id: '1' }], total: 1 });
    });
  });
});
