import { IAuthSettings } from '@domain/auth/contract/auth-settings.contract'
import { passwordPolicyViolations } from '@domain/auth/policy/password.policy'
import { EMAIL_MAX_LENGTH, normalizeEmail } from '@domain/user/util/email.util'
import { boolEnv, intEnv, isProduction, requiredEnv, requiredSecret } from '@infrastructure/config/env.util'
import { registerAs } from '@nestjs/config'

const MIN_BCRYPT_COST = 12
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function superAdminCredentials(): { email: string; password: string } {
  const email = normalizeEmail(requiredEnv('SUPERADMIN_EMAIL'))
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_SHAPE.test(email)) {
    throw new Error('SUPERADMIN_EMAIL is not a valid email address')
  }
  // Read raw: a password is never trimmed.
  const password = process.env.SUPERADMIN_PASSWORD
  if (!password) {
    throw new Error('Missing required environment variable: SUPERADMIN_PASSWORD')
  }
  const violations = passwordPolicyViolations(password)
  if (violations.length > 0) {
    throw new Error(`SUPERADMIN_PASSWORD is too weak: it needs ${violations.join(', ')}`)
  }
  return { email, password }
}

export const authConfig = registerAs('AuthConfig', () => {
  const jwtAccessSecret = requiredSecret('JWT_ACCESS_SECRET')
  const jwtRefreshSecret = requiredSecret('JWT_REFRESH_SECRET')
  const otpHmacSecret = requiredSecret('OTP_HMAC_SECRET')
  if (new Set([jwtAccessSecret, jwtRefreshSecret, otpHmacSecret]).size !== 3) {
    throw new Error('JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and OTP_HMAC_SECRET must be three different values')
  }
  const passwordSaltRounds = intEnv('PASSWORD_SALT_ROUNDS', MIN_BCRYPT_COST)
  if (passwordSaltRounds < MIN_BCRYPT_COST) {
    throw new Error(`PASSWORD_SALT_ROUNDS must be at least ${MIN_BCRYPT_COST}`)
  }
  const refreshTokenExpiresSeconds = intEnv('JWT_REFRESH_EXPIRES_SECONDS', 604800, 60)
  const sessionAbsoluteLifetimeSeconds = intEnv('SESSION_ABSOLUTE_LIFETIME_SECONDS', 2592000, 60)
  const superAdmin = superAdminCredentials()

  const settings: IAuthSettings = {
    requireApproval: boolEnv('REQUIRE_APPROVAL', true),
    superAdminEmail: superAdmin.email,
    superAdminPassword: superAdmin.password,
    maxFailedLogins: intEnv('LOGIN_MAX_FAILED_ATTEMPTS', 5, 1),
    lockoutMinutes: intEnv('LOGIN_LOCKOUT_MINUTES', 15, 1),
    otpTtlMinutes: intEnv('OTP_TTL_MINUTES', 10, 1),
    otpMaxAttempts: intEnv('OTP_MAX_ATTEMPTS', 5, 1),
    otpResendCooldownSeconds: intEnv('OTP_RESEND_COOLDOWN_SECONDS', 60),
    otpHourlyCap: intEnv('OTP_HOURLY_CAP', 5, 1),
    maxSessionsPerUser: intEnv('MAX_SESSIONS_PER_USER', 10, 1),
    sessionIdleTimeoutSeconds: intEnv('SESSION_IDLE_TIMEOUT_SECONDS', 0),
    sessionAbsoluteLifetimeSeconds,
    refreshGraceSeconds: intEnv('REFRESH_GRACE_SECONDS', 10),
    minResponseMs: intEnv('ANTI_ENUMERATION_MIN_RESPONSE_MS', 400),
  }

  return {
    jwtAccessSecret,
    jwtRefreshSecret,
    otpHmacSecret,
    accessTokenExpiresSeconds: intEnv('JWT_ACCESS_EXPIRES_SECONDS', 900, 30),
    refreshTokenExpiresSeconds,
    passwordSaltRounds,
    authEventRetentionDays: intEnv('AUTH_EVENT_RETENTION_DAYS', 90, 1),
    settings,
    cookie: {
      path: '/',
      sameSite: 'lax' as const,
      httpOnly: true,
      // Safari drops Secure cookies on plain http (even localhost), so a local prod-stack
      // compose overrides with COOKIE_SECURE=false; unset keeps the NODE_ENV-based default.
      secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction(),
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
  }
})
