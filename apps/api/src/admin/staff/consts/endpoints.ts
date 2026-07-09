export const ADMIN_STAFF_CONTROLLER_PATH = 'admin';

export const ADMIN_STAFF_ROUTES = {
  STAFF: 'staff',
  STAFF_BY_ID: 'staff/:id',
  STAFF_DEACTIVATE: 'staff/:id/deactivate',
  AUDIT_LOGS: 'audit-logs',
  AUDIT_LOGS_EXPORT: 'audit-logs/export',
  USER_ACTIVITY: 'user-activity',
} as const;

export const ADMIN_STAFF_DEFAULTS: {
  PAGE: number;
  LIMIT: number;
  USER_ACTIVITY_MAX_LIMIT: number;
} = {
  PAGE: 1,
  LIMIT: 25,
  USER_ACTIVITY_MAX_LIMIT: 100,
};
