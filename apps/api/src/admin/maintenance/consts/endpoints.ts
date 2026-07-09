export const ADMIN_MAINTENANCE_CONTROLLER_PATH = 'admin/maintenance';

export const ADMIN_MAINTENANCE_ROUTES = {
  METRICS: 'metrics',
  LOGS: 'logs',
  CONFIG: 'config',
  ASAAS_STATUS: 'asaas-status',
  BROADCAST: 'broadcast',
  REDIS_FLUSH: 'redis/flush',
  AI_USAGE: 'ai-usage',
} as const;

export const ADMIN_MAINTENANCE_DEFAULT_LOGS_LIMIT = 50;
export const ADMIN_MAINTENANCE_DEFAULT_PAGE = 1;
export const ADMIN_MAINTENANCE_DEFAULT_PAGE_LIMIT = 25;

/** Timeout for the outbound Asaas status probe. */
export const ADMIN_MAINTENANCE_ASAAS_STATUS_TIMEOUT_MS = 5000;
export const ADMIN_MAINTENANCE_ASAAS_STATUS_URL = 'https://api.asaas.com/v3/status';

/** Maps frontend camelCase config keys to DB snake_case keys. */
export const ADMIN_MAINTENANCE_CONFIG_KEY_MAP: Record<string, string> = {
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

export const ADMIN_MAINTENANCE_CONFIG_REVERSE_KEY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(ADMIN_MAINTENANCE_CONFIG_KEY_MAP).map(([k, v]) => [v, k]),
);
