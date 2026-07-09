import { Test } from '@nestjs/testing';
import { PlatformConfigService } from './platform-config.service';
import { PlatformConfigRepository } from './platform-config.repository';
import { DEFAULTS } from './consts/platform-config.consts';

describe('PlatformConfigService', () => {
  let service: PlatformConfigService;
  let repo: jest.Mocked<PlatformConfigRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PlatformConfigService,
        {
          provide: PlatformConfigRepository,
          useValue: { find: jest.fn(), upsert: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PlatformConfigService);
    repo = module.get(PlatformConfigRepository);
  });

  describe('getAll', () => {
    it('loads from the repository and merges with defaults', async () => {
      repo.find.mockResolvedValue([{ key: 'maintenance_mode', value: 'true' } as any]);
      const result = await service.getAll();
      expect(result.maintenance_mode).toBe('true');
      expect(result.duel_flash_entry_fee_cc).toBe(DEFAULTS.duel_flash_entry_fee_cc);
    });

    it('normalizes legacy camelCase keys to snake_case', async () => {
      repo.find.mockResolvedValue([{ key: 'maintenanceMode', value: 'true' } as any]);
      const result = await service.getAll();
      expect(result.maintenance_mode).toBe('true');
    });

    it('serves from cache on subsequent calls within TTL without re-querying', async () => {
      repo.find.mockResolvedValue([{ key: 'maintenance_mode', value: 'true' } as any]);
      await service.getAll();
      await service.getAll();
      expect(repo.find).toHaveBeenCalledTimes(1);
    });

    it('falls back to defaults only when the repository throws', async () => {
      repo.find.mockRejectedValue(new Error('db down'));
      const result = await service.getAll();
      expect(result).toEqual(DEFAULTS);
    });
  });

  describe('get', () => {
    it('returns the configured value', async () => {
      repo.find.mockResolvedValue([{ key: 'maintenance_message', value: 'custom msg' } as any]);
      const result = await service.get('maintenance_message');
      expect(result).toBe('custom msg');
    });

    it('returns empty string when the key has no default and is not set', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.get('unknown_key');
      expect(result).toBe('');
    });
  });

  describe('getNumber', () => {
    it('parses a numeric string value', async () => {
      repo.find.mockResolvedValue([{ key: 'rake_pct', value: '0.2' } as any]);
      const result = await service.getNumber('rake_pct');
      expect(result).toBe(0.2);
    });

    it('returns 0 for a non-numeric value', async () => {
      repo.find.mockResolvedValue([{ key: 'rake_pct', value: 'not-a-number' } as any]);
      const result = await service.getNumber('rake_pct');
      expect(result).toBe(0);
    });
  });

  describe('getBoolean', () => {
    it('returns true when the value is the string "true"', async () => {
      repo.find.mockResolvedValue([{ key: 'deposits_enabled', value: 'true' } as any]);
      const result = await service.getBoolean('deposits_enabled');
      expect(result).toBe(true);
    });

    it('returns false for any other value', async () => {
      repo.find.mockResolvedValue([{ key: 'deposits_enabled', value: 'false' } as any]);
      const result = await service.getBoolean('deposits_enabled');
      expect(result).toBe(false);
    });
  });

  describe('set', () => {
    it('persists via repository', async () => {
      repo.upsert.mockResolvedValue(undefined as any);
      await service.set('maintenance_mode', 'true', 'admin-1');
      expect(repo.upsert).toHaveBeenCalledWith('maintenance_mode', 'true', 'admin-1');
    });

    it('updates the in-memory cache entry so a subsequent warm getAll reflects it', async () => {
      repo.find.mockResolvedValue([{ key: 'maintenance_mode', value: 'false' } as any]);
      repo.upsert.mockResolvedValue(undefined as any);

      await service.getAll();
      await service.set('maintenance_mode', 'true');
      const result = await service.getBoolean('maintenance_mode');

      expect(result).toBe(true);
      expect(repo.find).toHaveBeenCalledTimes(1);
    });

    it('defaults updatedBy to null when not provided', async () => {
      repo.upsert.mockResolvedValue(undefined as any);
      await service.set('maintenance_mode', 'false');
      expect(repo.upsert).toHaveBeenCalledWith('maintenance_mode', 'false', null);
    });
  });

  describe('getPublicConfig', () => {
    it('maps flat config to the nested public shape using defaults', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.getPublicConfig();

      expect(result.fees.duelFlash).toBe(parseFloat(DEFAULTS.duel_flash_entry_fee_cc));
      expect(result.maintenance.active).toBe(false);
      expect(result.maintenance.message).toBe(DEFAULTS.maintenance_message);
      expect(result.features.depositsEnabled).toBe(true);
      expect(result.features.withdrawalsEnabled).toBe(true);
      expect(result.features.referralsEnabled).toBe(true);
      expect(result.matchmaking.maxRatingDiff).toBe(parseInt(DEFAULTS.matchmaking_max_rating_diff, 10));
    });

    it('reflects maintenance mode and disabled features when set', async () => {
      repo.find.mockResolvedValue([
        { key: 'maintenance_mode', value: 'true' } as any,
        { key: 'maintenance_message', value: 'Em manutenção' } as any,
        { key: 'deposits_enabled', value: 'false' } as any,
        { key: 'withdrawals_enabled', value: 'false' } as any,
        { key: 'referrals_enabled', value: 'false' } as any,
      ]);

      const result = await service.getPublicConfig();

      expect(result.maintenance.active).toBe(true);
      expect(result.maintenance.message).toBe('Em manutenção');
      expect(result.features.depositsEnabled).toBe(false);
      expect(result.features.withdrawalsEnabled).toBe(false);
      expect(result.features.referralsEnabled).toBe(false);
    });
  });
});
