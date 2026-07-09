export const ADMIN_AUTH_CONTROLLER_PATH = 'admin/auth';

export const ADMIN_AUTH_ROUTES = {
  REQUEST_OTP: 'request-otp',
  VERIFY_OTP: 'verify-otp',
  LOGOUT: 'logout',
  ME: 'me',
} as const;

/** OTP validity window before it must be re-requested. */
export const ADMIN_OTP_TTL_SECONDS = 10 * 60; // 10 min

/** Lockout duration after exceeding max OTP attempts. */
export const ADMIN_OTP_LOCKOUT_TTL_SECONDS = 5 * 60; // 5 min

/** Number of wrong OTP attempts allowed before lockout. */
export const ADMIN_OTP_MAX_ATTEMPTS = 3;

/** Admin session TTL in Redis — matches the JWT access token expiry. */
export const ADMIN_SESSION_TTL_SECONDS = 4 * 60 * 60; // 4h

export const ADMIN_JWT_EXPIRY = '4h';
