import { ICacheService } from '@application/shared/redis/redis.interface'
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { Redis as RedisClient } from 'ioredis'

@Injectable()
export class RedisService implements OnModuleDestroy, ICacheService {
  private readonly logger = new Logger(RedisService.name)

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redisClient: RedisClient
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing Redis connection')
    await this.redisClient.quit()
  }

  async ping(): Promise<string> {
    return this.redisClient.ping()
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key)
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.redisClient.get(key)
    if (!value) return null
    return JSON.parse(value) as T
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (ttlSeconds) {
      return this.redisClient.set(key, value, 'EX', ttlSeconds)
    }
    return this.redisClient.set(key, value)
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<'OK' | null> {
    return this.set(key, JSON.stringify(value), ttlSeconds)
  }

  async del(key: string): Promise<number> {
    return this.redisClient.del(key)
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redisClient.exists(key)) > 0
  }

  async lpush(key: string, value: string): Promise<number> {
    return this.redisClient.lpush(key, value)
  }

  async lrange(key: string, start = 0, stop = -1): Promise<string[]> {
    return this.redisClient.lrange(key, start, stop)
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    return this.redisClient.lrem(key, count, value)
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    const lockValue = randomUUID()
    const result = await this.redisClient.set(key, lockValue, 'EX', ttlSeconds, 'NX')
    return result === 'OK' ? lockValue : null
  }

  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `

    const result = await this.redisClient.eval(script, 1, key, lockValue)
    return result === 1
  }
}
