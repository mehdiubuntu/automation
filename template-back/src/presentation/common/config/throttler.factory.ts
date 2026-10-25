import { RATE_LIMIT_NAMES, RateLimitRule } from '@infrastructure/config/auth/rate-limit.config'
import { ExecutionContext } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { ThrottlerOptions } from '@nestjs/throttler'
import { RATE_LIMIT_KEY } from '@presentation/common/decorators/rate-limit.decorator'

const reflector = new Reflector()
const taggedLimit = (context: ExecutionContext): string | undefined =>
  reflector.getAllAndOverride<string | undefined>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()])

const toOptions = (name: string, rule: RateLimitRule, skipIf: (context: ExecutionContext) => boolean): ThrottlerOptions => ({
  name,
  limit: rule.limit,
  ttl: rule.ttlSeconds * 1000,
  skipIf,
})

/**
 * One named per-IP throttler per @RateLimit(name) bucket (strict, env-tunable), plus a generous
 * `global` one for every route that is not tagged. A route only counts against its own bucket.
 */
export function createThrottlers(configService: ConfigService): ThrottlerOptions[] {
  const rules = configService.get<Record<string, RateLimitRule>>('RateLimitConfig')!
  return [
    toOptions('global', rules.global, (context) => taggedLimit(context) !== undefined),
    ...RATE_LIMIT_NAMES.map((name) => toOptions(name, rules[name], (context) => taggedLimit(context) !== name)),
  ]
}
