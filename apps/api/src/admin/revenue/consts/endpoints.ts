export const ADMIN_REVENUE_CONTROLLER_PATH = 'admin/platform-revenue';

export const ADMIN_REVENUE_ROUTES = {
  SUMMARY: 'summary',
  HISTORY: 'history',
  CHART: 'chart',
} as const;

export const ADMIN_REVENUE_DEFAULTS = {
  HISTORY_PAGE: '1',
  HISTORY_LIMIT: '50',
  CHART_DAYS: '30',
} as const;
