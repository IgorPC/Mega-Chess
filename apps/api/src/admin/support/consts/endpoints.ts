export const ADMIN_SUPPORT_CONTROLLER_PATH = 'admin/support/tickets';

export const ADMIN_SUPPORT_ROUTES = {
  LIST: '',
  BY_ID: ':id',
  MESSAGES: ':id/messages',
  UPDATE_STATUS: ':id',
  ASSIGN: ':id/assign',
  AI_SUMMARY: ':id/ai-summary',
} as const;

export const ADMIN_SUPPORT_DEFAULTS = {
  PAGE: 1,
  LIMIT: 25,
} as const;
