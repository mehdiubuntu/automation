import { OUTBOX_REPOSITORY_TOKEN, type IOutboxRepository } from '@domain/outbox/repository/outbox.repository'
import { HEALTH_PROBE_TOKEN, type IHealthProbe } from '@domain/shared/health/health-probe.contract'
import { Inject, Injectable } from '@nestjs/common'

export interface HealthView {
  status: 'ok' | 'degraded'
  db: 'ok' | 'down'
  redis: 'ok' | 'down' | 'disabled'
  /** Outbox rows due for delivery right now — the true dispatch backlog. */
  outboxBacklog: number
}

/** The real deploy healthcheck (§13.2 / R6) — replaces the "any response < 500" probe. */
@Injectable()
export class HealthUseCase {
  constructor(
    @Inject(HEALTH_PROBE_TOKEN)
    private readonly probe: IHealthProbe,
    @Inject(OUTBOX_REPOSITORY_TOKEN)
    private readonly outboxRepository: IOutboxRepository
  ) {}

  async getHealth(): Promise<HealthView> {
    const db = await this.probe.database()
    const redis = await this.probe.redis()
    let outboxBacklog = 0
    if (db) {
      const now = new Date()
      const counts = await this.outboxRepository.countHealth(now, new Date(now.getTime() - 24 * 60 * 60 * 1000))
      outboxBacklog = counts.dueNow
    }
    return {
      status: db && redis !== 'down' ? 'ok' : 'degraded',
      db: db ? 'ok' : 'down',
      redis,
      outboxBacklog,
    }
  }
}
