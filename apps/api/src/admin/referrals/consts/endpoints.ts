export const ADMIN_REFERRALS_CONTROLLER_PATH = 'admin/referrals';

export const ADMIN_REFERRALS_ROUTES = {
  ROOT: '',
  STATS: 'stats',
} as const;

export const ADMIN_REFERRALS_DEFAULT_PAGE = 1;
export const ADMIN_REFERRALS_DEFAULT_LIMIT = 25;

/** Supported "stats" period buckets, in days. */
export const ADMIN_REFERRALS_STATS_PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '15d': 15,
  '30d': 30,
  '90d': 90,
};
