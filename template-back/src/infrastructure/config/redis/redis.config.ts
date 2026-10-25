import { registerAs } from '@nestjs/config'

export interface RedisConfig {
  /** REDIS_ENABLED=true opts in; otherwise nothing connects and the client/cache providers are null. */
  enabled: boolean
  host: string
  port: number
  password: string
}

export const redisConfig = registerAs(
  'redis',
  (): RedisConfig => ({
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || 'redis123456',
  })
)
