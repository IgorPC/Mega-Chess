export const ADMIN_DASHBOARD_CONTROLLER_PATH = 'admin/dashboard';

export const ADMIN_DASHBOARD_ROUTES = {
  KPIS: 'kpis',
  TOP_WINNERS: 'top-winners',
  ALERTS: 'alerts',
} as const;

/** Window used for the "top winners" leaderboard. */
export const ADMIN_DASHBOARD_TOP_WINNERS_DAYS = 7;
export const ADMIN_DASHBOARD_TOP_WINNERS_LIMIT = 10;

/** Alert thresholds. */
export const ADMIN_DASHBOARD_OPEN_TICKETS_ALERT_THRESHOLD = 10;
