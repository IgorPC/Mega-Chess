export const ADMIN_IP_BLACKLIST_CONTROLLER_PATH = 'admin/ip-blacklist';

export const ADMIN_IP_BLACKLIST_ROUTES = {
  ROOT: '',
  BY_IP: ':ip',
} as const;

/** Default and max page size for the blacklist listing. */
export const ADMIN_IP_BLACKLIST_DEFAULT_LIMIT = 25;
export const ADMIN_IP_BLACKLIST_MAX_LIMIT = 100;

/** TTL applied to a "permanent" blacklist entry's Redis mirror (10 years). */
export const ADMIN_IP_BLACKLIST_PERMANENT_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;
