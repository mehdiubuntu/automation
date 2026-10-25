import { GenericException } from '@domain/shared/error/base-http.exception'

const MODULE = 'AUTH'

/** Stable codes the frontend switches on - never rename one. */
export const AuthErrorCode = {
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  PENDING_APPROVAL: 'AUTH_PENDING_APPROVAL',
  BLOCKED: 'AUTH_BLOCKED',
  LOCKED: 'AUTH_LOCKED',
  INVALID_OTP: 'AUTH_INVALID_OTP',
  INVALID_SESSION: 'AUTH_INVALID_SESSION',
  SESSION_NOT_FOUND: 'AUTH_SESSION_NOT_FOUND',
  FORBIDDEN: 'AUTH_FORBIDDEN',
  INVALID_CURRENT_PASSWORD: 'AUTH_INVALID_CURRENT_PASSWORD',
  PASSWORD_REUSED: 'AUTH_PASSWORD_REUSED',
  WEAK_PASSWORD: 'AUTH_WEAK_PASSWORD',
  PASSWORD_MANAGED_BY_ENV: 'AUTH_PASSWORD_MANAGED_BY_ENV',
  ORIGIN_NOT_ALLOWED: 'AUTH_ORIGIN_NOT_ALLOWED',
  RATE_LIMITED: 'AUTH_RATE_LIMITED',
} as const

export const AuthErrors = {
  invalidCredentials: () => new GenericException('Invalid email or password.', 401, MODULE, AuthErrorCode.INVALID_CREDENTIALS),
  emailNotVerified: () => new GenericException('Your email address is not verified yet.', 403, MODULE, AuthErrorCode.EMAIL_NOT_VERIFIED),
  pendingApproval: () => new GenericException('Your account is waiting for administrator approval.', 403, MODULE, AuthErrorCode.PENDING_APPROVAL),
  blocked: () => new GenericException('Your account is blocked.', 403, MODULE, AuthErrorCode.BLOCKED),
  locked: () => new GenericException('Too many failed attempts. The account is temporarily locked.', 403, MODULE, AuthErrorCode.LOCKED),
  invalidOtp: () => new GenericException('The code is invalid or has expired.', 400, MODULE, AuthErrorCode.INVALID_OTP),
  invalidSession: () => new GenericException('Invalid or expired session.', 401, MODULE, AuthErrorCode.INVALID_SESSION),
  sessionNotFound: () => new GenericException('Session not found.', 404, MODULE, AuthErrorCode.SESSION_NOT_FOUND),
  forbidden: () => new GenericException('You do not have permission to perform this action.', 403, MODULE, AuthErrorCode.FORBIDDEN),
  invalidCurrentPassword: () => new GenericException('The current password is incorrect.', 400, MODULE, AuthErrorCode.INVALID_CURRENT_PASSWORD),
  passwordReused: () => new GenericException('The new password must be different from the current one.', 400, MODULE, AuthErrorCode.PASSWORD_REUSED),
  weakPassword: (requirements: string[]) => new GenericException(`Password must contain ${requirements.join(', ')}.`, 400, MODULE, AuthErrorCode.WEAK_PASSWORD),
  passwordManagedByEnv: () =>
    new GenericException('The super administrator password is managed through the server configuration.', 403, MODULE, AuthErrorCode.PASSWORD_MANAGED_BY_ENV),
  originNotAllowed: () => new GenericException('Request origin is not allowed.', 403, MODULE, AuthErrorCode.ORIGIN_NOT_ALLOWED),
  rateLimited: () => new GenericException('Too many requests. Please try again later.', 429, MODULE, AuthErrorCode.RATE_LIMITED),
}

export const GENERIC_ACCEPTED_MESSAGE = 'If the request can be processed, an email with instructions will arrive shortly.'
