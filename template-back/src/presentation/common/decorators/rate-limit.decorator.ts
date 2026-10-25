import { RateLimitName } from '@infrastructure/config/auth/rate-limit.config'
import { SetMetadata } from '@nestjs/common'

export const RATE_LIMIT_KEY = 'rateLimit'

/** Puts the handler under the named per-IP limit (RATE_LIMIT_<NAME>_* env) instead of the generous global one. */
export const RateLimit = (name: RateLimitName) => SetMetadata(RATE_LIMIT_KEY, name)
