import { CACHE_SERVICE_TOKEN } from '@application/shared/redis/redis.interface'
import { RedisConfig } from '@infrastructure/config/redis/redis.config'
import { RedisService } from '@infrastructure/redis/redis.service'
import { Logger, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService): Redis | null => {
        const logger = new Logger('RedisProvider')
        const config = configService.get<RedisConfig>('redis')
        // Opt-in: with REDIS_ENABLED off nothing connects and consumers receive null.
        if (!config?.enabled) return null

        const redisClient = new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
          retryStrategy(times) {
            return Math.min(times * 100, 2000)
          },
        })
        redisClient.on('connect', () => logger.log('Redis connecting...'))
        redisClient.on('ready', () => logger.log('Redis connected'))
        redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`, err.stack))
        redisClient.on('close', () => logger.warn('Redis connection closed'))
        redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'))

        return redisClient
      },
      inject: [ConfigService],
    },
    {
      provide: CACHE_SERVICE_TOKEN,
      useFactory: (client: Redis | null) => (client ? new RedisService(client) : null),
      inject: ['REDIS_CLIENT'],
    },
  ],
  exports: ['REDIS_CLIENT', CACHE_SERVICE_TOKEN],
})
export class RedisModule {}
