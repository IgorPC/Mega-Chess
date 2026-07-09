export const ADMIN_SUGGESTIONS_CONTROLLER_PATH = 'admin/suggestions';

export const ADMIN_SUGGESTIONS_ROUTES = {
  LIST: '',
  UPDATE: ':id',
} as const;

export const ADMIN_SUGGESTIONS_DEFAULTS = {
  PAGE: 1,
  LIMIT: 25,
} as const;
