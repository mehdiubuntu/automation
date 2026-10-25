import { intEnv } from '@infrastructure/config/env.util'
import { registerAs } from '@nestjs/config'

export const RATE_LIMIT_NAMES = ['register', 'login', 'resend', 'verifyOtp', 'refresh', 'sensitive'] as const
export type RateLimitName = (typeof RATE_LIMIT_NAMES)[number]

export interface RateLimitRule {
  limit: number
  ttlSeconds: number
}

const DEFAULTS: Record<RateLimitName | 'global', RateLimitRule> = {
  global: { limit: 120, ttlSeconds: 60 },
  register: { limit: 10, ttlSeconds: 3600 },
  login: { limit: 10, ttlSeconds: 60 },
  resend: { limit: 5, ttlSeconds: 600 },
  verifyOtp: { limit: 10, ttlSeconds: 600 },
  refresh: { limit: 30, ttlSeconds: 60 },
  sensitive: { limit: 10, ttlSeconds: 600 },
}

const ENV_PREFIX: Record<RateLimitName | 'global', string> = {
  global: 'RATE_LIMIT_GLOBAL',
  register: 'RATE_LIMIT_REGISTER',
  login: 'RATE_LIMIT_LOGIN',
  resend: 'RATE_LIMIT_RESEND',
  verifyOtp: 'RATE_LIMIT_VERIFY_OTP',
  refresh: 'RATE_LIMIT_REFRESH',
  sensitive: 'RATE_LIMIT_SENSITIVE',
}

/** Per-IP limits, each as <PREFIX>_LIMIT requests per <PREFIX>_TTL_SECONDS. */
export const rateLimitConfig = registerAs('RateLimitConfig', () => {
  const rules = {} as Record<RateLimitName | 'global', RateLimitRule>
  for (const name of Object.keys(DEFAULTS) as Array<RateLimitName | 'global'>) {
    rules[name] = {
      limit: intEnv(`${ENV_PREFIX[name]}_LIMIT`, DEFAULTS[name].limit, 1),
      ttlSeconds: intEnv(`${ENV_PREFIX[name]}_TTL_SECONDS`, DEFAULTS[name].ttlSeconds, 1),
    }
  }
  return rules
})
