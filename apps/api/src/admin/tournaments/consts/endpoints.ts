export const ADMIN_TOURNAMENTS_CONTROLLER_PATH = 'admin/tournaments';

export const ADMIN_TOURNAMENTS_ROUTES = {
  LIST: '',
  DUELS: 'duels',
  MATCH_MOVES: 'matches/:tmId/moves',
  MATCH_ANALYZE: 'matches/:tmId/analyze',
  BY_ID: ':id',
  PARTICIPANTS: ':id/participants',
  MATCHES: ':id/matches',
  START: ':id/start',
  CANCEL: ':id/cancel',
  REMOVE_PARTICIPANT: ':id/participants/:userId',
} as const;

export const ADMIN_TOURNAMENTS_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
} as const;

// Status values mapped to/from the frontend-facing simplified vocabulary
export const ADMIN_TOURNAMENTS_STATUS_MAP: Record<string, string> = {
  OPEN: 'REGISTERING',
  COMPLETED: 'FINISHED',
};

export const ADMIN_TOURNAMENTS_WHITE_WIN_RESULTS = ['WHITE_WINS', 'FORFEIT_BLACK', 'TIMEOUT_BLACK'];
export const ADMIN_TOURNAMENTS_BLACK_WIN_RESULTS = ['BLACK_WINS', 'FORFEIT_WHITE', 'TIMEOUT_WHITE'];
