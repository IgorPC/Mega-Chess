import { Injectable, Logger } from '@nestjs/common';
import { PlatformConfigRepository } from './platform-config.repository';
import { CACHE_TTL_MS, LEGACY_KEY_MAP, DEFAULTS } from './consts/platform-config.consts';

@Injectable()
export class PlatformConfigService {
  private readonly logger = new Logger(PlatformConfigService.name);
  private cache: Map<string, string> = new Map();
  private cacheExpiry = 0;

  constructor(private readonly repo: PlatformConfigRepository) {}

  async getAll(): Promise<Record<string, string>> {
    if (Date.now() < this.cacheExpiry && this.cache.size > 0) {
      return Object.fromEntries(this.cache);
    }

    try {
      const rows = await this.repo.find();
      this.cache = new Map(
        rows.map((r) => [LEGACY_KEY_MAP[r.key] ?? r.key, r.value]),
      );
      this.cacheExpiry = Date.now() + CACHE_TTL_MS;
    } catch (err) {
      this.logger.warn(`Failed to load platform config: ${err?.message}`);
    }

    return { ...DEFAULTS, ...Object.fromEntries(this.cache) };
  }

  async get(key: string): Promise<string> {
    const all = await this.getAll();
    return all[key] ?? DEFAULTS[key] ?? '';
  }

  async getNumber(key: string): Promise<number> {
    return parseFloat(await this.get(key)) || 0;
  }

  async getBoolean(key: string): Promise<boolean> {
    return (await this.get(key)) === 'true';
  }

  async set(key: string, value: string, updatedBy?: string): Promise<void> {
    await this.repo.upsert(key, value, updatedBy ?? null);
    this.cache.set(key, value);
  }

  async getPublicConfig() {
    const cfg = await this.getAll();
    return {
      fees: {
        duelFlash: parseFloat(cfg.duel_flash_entry_fee_cc),
        duelGiant: parseFloat(cfg.duel_giant_entry_fee_cc),
        faisca: parseFloat(cfg.faisca_entry_fee_cc),
        tempestade: parseFloat(cfg.tempestade_entry_fee_cc),
        grande: parseFloat(cfg.grande_entry_fee_cc),
        withdrawalPct: parseFloat(cfg.withdrawal_fee_pct),
        withdrawalMin: parseFloat(cfg.withdrawal_fee_min_cc),
        withdrawalMinBalance: parseFloat(cfg.withdrawal_min_balance_cc),
        rakePct: parseFloat(cfg.rake_pct),
      },
      matchmaking: {
        maxRatingDiff: parseInt(cfg.matchmaking_max_rating_diff, 10),
      },
      maintenance: {
        active: cfg.maintenance_mode === 'true',
        message: cfg.maintenance_message,
      },
      features: {
        depositsEnabled: cfg.deposits_enabled !== 'false',
        withdrawalsEnabled: cfg.withdrawals_enabled !== 'false',
        referralsEnabled: cfg.referrals_enabled !== 'false',
      },
    };
  }
}
