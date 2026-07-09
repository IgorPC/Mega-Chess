export const ASAAS_BASE_URL_PRODUCTION = 'https://api.asaas.com/v3';
export const ASAAS_BASE_URL_SANDBOX = 'https://api-sandbox.asaas.com/v3';

export const ASAAS_MAX_RETRIES = 3;
export const ASAAS_RETRY_BACKOFF_BASE_MS = 1000;

export const ASAAS_PATHS = {
  CUSTOMERS: '/customers',
  CUSTOMER_BY_ID: (id: string) => `/customers/${id}`,
  PAYMENTS: '/payments',
  PAYMENT_BY_ID: (id: string) => `/payments/${id}`,
  PAYMENT_PIX_QR_CODE: (id: string) => `/payments/${id}/pixQrCode`,
  TRANSFERS: '/transfers',
} as const;

export const DEPOSIT_DESCRIPTION = 'Depósito Mega Chess Online';
export const WITHDRAWAL_DESCRIPTION = 'Saque Mega Chess Online';

// Sandbox-only: segundos após criar uma cobrança PIX antes de marcá-la como paga
// automaticamente e creditada direto no banco, para que usuários de teste possam
// testar duelos sem pagamento real. Nunca roda quando ASAAS_ENV=production.
export const SANDBOX_AUTO_APPROVE_DELAY_MS = 10_000;
