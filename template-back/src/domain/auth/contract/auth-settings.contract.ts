export const AUTH_SETTINGS_TOKEN = Symbol('AUTH_SETTINGS_TOKEN')

/** Every tunable the auth use-cases read, resolved once from env (AuthConfig) so tests can pass a literal. */
export interface IAuthSettings {
  requireApproval: boolean
  superAdminEmail: string
  superAdminPassword: string
  maxFailedLogins: number
  lockoutMinutes: number
  otpTtlMinutes: number
  otpMaxAttempts: number
  otpResendCooldownSeconds: number
  otpHourlyCap: number
  maxSessionsPerUser: number
  /** 0 disables the idle timeout. */
  sessionIdleTimeoutSeconds: number
  /** Hard cap on a session's life however often it is refreshed. */
  sessionAbsoluteLifetimeSeconds: number
  /** A just-rotated refresh token is tolerated this long (parallel refreshes from one browser). */
  refreshGraceSeconds: number
  /** Floor for anti-enumeration endpoints so existing and unknown emails take the same time. */
  minResponseMs: number
}
