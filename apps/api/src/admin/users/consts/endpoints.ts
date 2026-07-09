export const ADMIN_USERS_CONTROLLER_PATH = 'admin/users';

export const ADMIN_USERS_ROUTES = {
  LIST: '',
  EXPORT: 'export',
  BY_ID: ':id',
  TRANSACTIONS: ':id/transactions',
  TICKETS: ':id/tickets',
  ACTIVITY: ':id/activity',
  MESSAGE: ':id/message',
  SUSPEND: ':id/suspend',
  FORCE_LOGOUT: ':id/force-logout',
  ELO: ':id/elo',
} as const;

export const ADMIN_USERS_DEFAULTS: {
  PAGE: number;
  LIMIT: number;
  ACTIVITY_LIMIT: number;
} = {
  PAGE: 1,
  LIMIT: 20,
  ACTIVITY_LIMIT: 50,
};

export const ADMIN_USERS_ELO_MIN = 100;
export const ADMIN_USERS_ELO_MAX = 3000;
export const ADMIN_USERS_SUSPEND_REASON_MIN_LENGTH = 30;
