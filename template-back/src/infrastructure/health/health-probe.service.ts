import { IHealthProbe } from '@domain/shared/health/health-probe.contract'
import { Inject, Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import type { Redis } from 'ioredis'
import { DataSource } from 'typeorm'

@Injectable()
export class HealthProbeService implements IHealthProbe {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    // RedisModule's client — null while REDIS_ENABLED is off.
    @Inject('REDIS_CLIENT')
    private readonly redisConnection: Redis | null
  ) {}

  async database(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  async redis(): Promise<'ok' | 'down' | 'disabled'> {
    if (!this.redisConnection) return 'disabled'
    try {
      await this.redisConnection.ping()
      return 'ok'
    } catch {
      return 'down'
    }
  }
}
