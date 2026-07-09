import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformConfigRepository } from './platform-config.repository';
import { PlatformConfig } from './entities/platform-config.entity';

describe('PlatformConfigRepository', () => {
  let repository: PlatformConfigRepository;
  let ormRepo: jest.Mocked<Repository<PlatformConfig>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PlatformConfigRepository,
        {
          provide: getRepositoryToken(PlatformConfig),
          useValue: { find: jest.fn(), upsert: jest.fn() },
        },
      ],
    }).compile();

    repository = module.get(PlatformConfigRepository);
    ormRepo = module.get(getRepositoryToken(PlatformConfig));
  });

  describe('find', () => {
    it('returns all config rows', async () => {
      const rows = [{ key: 'a', value: '1' }] as PlatformConfig[];
      ormRepo.find.mockResolvedValue(rows);
      const result = await repository.find();
      expect(result).toBe(rows);
    });
  });

  describe('upsert', () => {
    it('upserts by key with updatedBy provided', async () => {
      ormRepo.upsert.mockResolvedValue({} as any);
      await repository.upsert('maintenance_mode', 'true', 'admin-1');
      expect(ormRepo.upsert).toHaveBeenCalledWith(
        { key: 'maintenance_mode', value: 'true', updatedBy: 'admin-1' },
        ['key'],
      );
    });

    it('defaults updatedBy to null when omitted', async () => {
      ormRepo.upsert.mockResolvedValue({} as any);
      await repository.upsert('maintenance_mode', 'true');
      expect(ormRepo.upsert).toHaveBeenCalledWith(
        { key: 'maintenance_mode', value: 'true', updatedBy: null },
        ['key'],
      );
    });
  });
});
