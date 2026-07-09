export const CACHE_TTL_MS = 10_000;

// Legacy camelCase keys that may exist in the DB from before the key normalization fix.
// Maps old camelCase key → canonical snake_case key used everywhere in the service.
export const LEGACY_KEY_MAP: Record<string, string> = {
  maintenanceMode: 'maintenance_mode',
  aiAnalysisEnabled: 'ai_analysis_enabled',
  depositsEnabled: 'deposits_enabled',
  withdrawalsEnabled: 'withdrawals_enabled',
  referralsEnabled: 'referrals_enabled',
  maxConcurrentGames: 'max_concurrent_games',
  withdrawalDailyLimitCc: 'withdrawal_daily_limit_cc',
  depositMinBrl: 'deposit_min_brl',
  depositMaxBrl: 'deposit_max_brl',
};

export const DEFAULTS: Record<string, string> = {
  duel_flash_entry_fee_cc: '10',
  duel_giant_entry_fee_cc: '50',
  faisca_entry_fee_cc: '5',
  tempestade_entry_fee_cc: '5',
  grande_entry_fee_cc: '15',
  withdrawal_fee_pct: '0.04',
  withdrawal_fee_min_cc: '3',
  deposits_enabled: 'true',
  withdrawals_enabled: 'true',
  referrals_enabled: 'true',
  withdrawal_min_balance_cc: '10',
  rake_pct: '0.10',
  elo_k_factor: '32',
  matchmaking_max_rating_diff: '200',
  maintenance_mode: 'false',
  maintenance_message: 'O sistema está em manutenção. Voltamos em breve!',
};

export const CONFIG_ENDPOINTS = {
  ROOT: 'config',
  PUBLIC: 'public',
} as const;
