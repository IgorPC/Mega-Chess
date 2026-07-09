export const ADMIN_REPORTS_CONTROLLER_PATH = 'admin/match-reports';

export const ADMIN_REPORTS_ROUTES = {
  ROOT: '',
  BY_ID: ':id',
  RESOLVE: ':id/resolve',
  ANALYZE: ':id/analyze',
  DELETE_REVIEW: 'reviews/:id',
} as const;

export const ADMIN_REPORTS_DEFAULT_PAGE = 1;
export const ADMIN_REPORTS_DEFAULT_LIMIT = 25;
export const ADMIN_REPORTS_MAX_LIMIT = 100;

/** Number of prior reports/tickets shown as history on a report's detail view. */
export const ADMIN_REPORTS_HISTORY_TAKE = 5;

/** Cap on PGN size sent to the AI analyzer, and its SLA in seconds. */
export const ADMIN_REPORTS_AI_PGN_MAX_CHARS = 3000;
export const ADMIN_REPORTS_AI_ANALYSIS_SLA_SECONDS = 600;

/** A move under this duration (ms) counts as "suspiciously fast" for anti-cheat heuristics. */
export const ADMIN_REPORTS_FAST_MOVE_THRESHOLD_MS = 1500;

/** AI verdict confidence above which a report is escalated to UNDER_REVIEW. */
export const ADMIN_REPORTS_AI_ESCALATION_CONFIDENCE = 0.7;
