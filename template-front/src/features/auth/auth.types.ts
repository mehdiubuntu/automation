/** Mirrors the backend auth contract. Enums are string unions, not TS enums. */

export const USER_ROLES = ['SUPERADMIN', 'SPARTAN'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: 'Super admin',
  SPARTAN: 'Spartan',
}

export const USER_STATUSES = ['PENDING_VERIFICATION', 'PENDING_APPROVAL', 'ACTIVE', 'BLOCKED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PENDING_VERIFICATION: 'Pending verification',
  PENDING_APPROVAL: 'Pending approval',
  ACTIVE: 'Active',
  BLOCKED: 'Blocked',
}

/** The signed-in user, as returned by POST /auth/login and GET /auth/me. */
export interface AuthUser {
  id: string
  email: string
  role: UserRole
  status: UserStatus
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  password: string
}

/** Body returned by POST /auth/login on success (tokens travel in HttpOnly cookies). */
export interface LoginResult {
  user: AuthUser
}

export interface VerifyEmailInput {
  email: string
  /** 6-digit one-time code from the verification email. */
  code: string
}

export interface ResetPasswordInput {
  email: string
  code: string
  newPassword: string
}

/** Status the account lands in after its email is verified. */
export type VerifyEmailStatus = 'PENDING_APPROVAL' | 'ACTIVE'

export interface VerifyEmailResult {
  status: VerifyEmailStatus
}

/** Length of every emailed one-time code. */
export const OTP_LENGTH = 6

/** `errorCode` values the OTP endpoints (verify-email, reset-password) can fail with. */
export const OTP_ERROR_CODES = ['AUTH_INVALID_OTP', 'AUTH_OTP_EXPIRED', 'AUTH_OTP_ATTEMPTS_EXCEEDED'] as const
export type OtpErrorCode = (typeof OTP_ERROR_CODES)[number]

/** `errorCode` values POST /auth/login can fail with. */
export const LOGIN_ERROR_CODES = [
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_EMAIL_NOT_VERIFIED',
  'AUTH_PENDING_APPROVAL',
  'AUTH_BLOCKED',
  'AUTH_LOCKED',
] as const
export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number]

export function isLoginErrorCode(code: string | undefined): code is LoginErrorCode {
  return code !== undefined && (LOGIN_ERROR_CODES as readonly string[]).includes(code)
}
