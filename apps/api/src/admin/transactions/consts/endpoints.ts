export const ADMIN_TRANSACTIONS_CONTROLLER_PATH = 'admin';

export const ADMIN_TRANSACTIONS_ROUTES = {
  TRANSACTIONS: 'transactions',
  DEPOSITS: 'deposits',
  WITHDRAWALS: 'withdrawals',
  WITHDRAWAL_APPROVE: 'withdrawals/:id/approve',
  WITHDRAWAL_REJECT: 'withdrawals/:id/reject',
  REFUND: 'transactions/refund',
  FINANCIAL_SUMMARY: 'transactions/financial-summary',
  RAKE_SUMMARY: 'transactions/rake-summary',
} as const;

export const ADMIN_TRANSACTIONS_DEFAULTS: {
  PAGE: number;
  LIMIT: number;
  FINANCIAL_SUMMARY_PERIOD: string;
  RAKE_SUMMARY_PERIOD: string;
} = {
  PAGE: 1,
  LIMIT: 20,
  FINANCIAL_SUMMARY_PERIOD: 'all',
  RAKE_SUMMARY_PERIOD: '30d',
};

export const ADMIN_TRANSACTIONS_PERIOD_DAYS: Record<string, number> = {
  '7d': 7, '15d': 15, '30d': 30, '90d': 90,
};
