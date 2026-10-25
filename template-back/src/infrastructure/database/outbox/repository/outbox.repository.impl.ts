import { OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { OutboxStatus } from '@domain/outbox/enum/outbox.enum'
import { IOutboxRepository, OutboxHealthCounts, OutboxProblemBreakdown } from '@domain/outbox/repository/outbox.repository'
import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { OutboxMapper } from '@infrastructure/database/outbox/mapper/outbox.mapper'
import { OutboxOrmEntity } from '@infrastructure/database/outbox/orm-entity/outbox.orm.entity'
import { findPaginate } from '@infrastructure/database/shared/pagination/pagination.service'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, ILike, In, LessThan, MoreThan, Repository } from 'typeorm'
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'

@Injectable()
export class OutboxRepositoryImpl implements IOutboxRepository {
  constructor(
    @InjectRepository(OutboxOrmEntity)
    private readonly outboxRepo: Repository<OutboxOrmEntity>
  ) {}

  async insertOne(entity: OutboxMessage): Promise<OutboxMessage> {
    const saved = await this.outboxRepo.save(OutboxMapper.toOrm(entity))
    return OutboxMapper.toDomain(saved)
  }

  async findById(id: string): Promise<OutboxMessage | null> {
    const row = await this.outboxRepo.findOne({ where: { id } })
    return row ? OutboxMapper.toDomain(row) : null
  }

  async findMessages(query: Parameters<IOutboxRepository['findMessages']>[0]) {
    const base: FindOptionsWhere<OutboxOrmEntity> = {}
    if (query.status) base.status = OutboxMapper.mapStatusToOrm(query.status)
    if (query.eventType) base.eventType = query.eventType
    if (query.aggregateId) base.aggregateId = query.aggregateId
    // "Retrying" is not a stored state — it is PENDING with at least one attempt made.
    if (query.retryingOnly) {
      base.status = OutboxMapper.mapStatusToOrm(OutboxStatus.PENDING)
      base.retryCount = MoreThan(0)
    }

    // Free text spans the recipient key, the event type and the recorded error.
    const term = query.search?.trim()
    const where: FindOptionsWhere<OutboxOrmEntity> | FindOptionsWhere<OutboxOrmEntity>[] = term
      ? [
          { ...base, aggregateId: ILike(`%${term}%`) },
          { ...base, eventType: ILike(`%${term}%`) },
          { ...base, lastError: ILike(`%${term}%`) },
        ]
      : base

    return findPaginate<OutboxOrmEntity, OutboxMessage>({
      repository: this.outboxRepo,
      mapper: OutboxMapper,
      options: { where },
      params: {
        page: query.page,
        limit: query.limit,
        sort: [{ sortBy: 'createdAt', order: query.order ?? OrderDirectionEnum.DESC }],
      },
    })
  }

  async countHealth(now: Date, since24h: Date): Promise<OutboxHealthCounts> {
    const raw = await this.outboxRepo
      .createQueryBuilder('outbox')
      .select(`COUNT(*) FILTER (WHERE outbox.status = :pending)::int`, 'pending')
      .addSelect(`COUNT(*) FILTER (WHERE outbox.status = :processing)::int`, 'processing')
      .addSelect(`COUNT(*) FILTER (WHERE outbox.status = :published)::int`, 'published')
      .addSelect(`COUNT(*) FILTER (WHERE outbox.status = :failed)::int`, 'failed')
      .addSelect(`COUNT(*) FILTER (WHERE outbox.status = :cancelled)::int`, 'cancelled')
      .addSelect(`COUNT(*) FILTER (WHERE outbox.status = :pending AND outbox."retryCount" > 0)::int`, 'retrying')
      .addSelect(`COUNT(*) FILTER (WHERE outbox.status = :pending AND outbox."nextAttemptAt" <= :now)::int`, 'dueNow')
      .addSelect(`COUNT(*) FILTER (WHERE outbox.status = :published AND outbox."publishedAt" >= :since)::int`, 'publishedLast24h')
      .addSelect(`COUNT(*) FILTER (WHERE outbox."createdAt" >= :since)::int`, 'queuedLast24h')
      .setParameters({
        pending: OutboxMapper.mapStatusToOrm(OutboxStatus.PENDING),
        processing: OutboxMapper.mapStatusToOrm(OutboxStatus.PROCESSING),
        published: OutboxMapper.mapStatusToOrm(OutboxStatus.PUBLISHED),
        failed: OutboxMapper.mapStatusToOrm(OutboxStatus.FAILED),
        cancelled: OutboxMapper.mapStatusToOrm(OutboxStatus.CANCELLED),
        now,
        since: since24h,
      })
      .getRawOne<Record<string, number>>()

    return {
      pending: Number(raw?.pending ?? 0),
      processing: Number(raw?.processing ?? 0),
      published: Number(raw?.published ?? 0),
      failed: Number(raw?.failed ?? 0),
      cancelled: Number(raw?.cancelled ?? 0),
      retrying: Number(raw?.retrying ?? 0),
      dueNow: Number(raw?.dueNow ?? 0),
      publishedLast24h: Number(raw?.publishedLast24h ?? 0),
      queuedLast24h: Number(raw?.queuedLast24h ?? 0),
    }
  }

  async countProblemsByEventType(): Promise<OutboxProblemBreakdown[]> {
    const rows = await this.outboxRepo
      .createQueryBuilder('outbox')
      .select('outbox."eventType"', 'eventType')
      .addSelect(`COUNT(*) FILTER (WHERE outbox.status = :pending)::int`, 'pending')
      .addSelect(`COUNT(*) FILTER (WHERE outbox.status = :failed)::int`, 'failed')
      .addSelect(`COUNT(*) FILTER (WHERE outbox.status = :cancelled)::int`, 'cancelled')
      // Problem states only — counting delivered rows by kind would scan the whole history.
      .where('outbox.status IN (:...problemStates)')
      .setParameters({
        pending: OutboxMapper.mapStatusToOrm(OutboxStatus.PENDING),
        failed: OutboxMapper.mapStatusToOrm(OutboxStatus.FAILED),
        cancelled: OutboxMapper.mapStatusToOrm(OutboxStatus.CANCELLED),
        problemStates: [OutboxStatus.PENDING, OutboxStatus.FAILED, OutboxStatus.CANCELLED].map((status) => OutboxMapper.mapStatusToOrm(status)),
      })
      .groupBy('outbox."eventType"')
      .getRawMany<{ eventType: string; pending: number; failed: number; cancelled: number }>()

    return rows.map((row) => ({
      eventType: row.eventType,
      pending: Number(row.pending),
      failed: Number(row.failed),
      cancelled: Number(row.cancelled),
    }))
  }

  async transitionWhileInStatus(
    id: string,
    expectedStatuses: OutboxStatus[],
    patch: { status: OutboxStatus; retryCount?: number; nextAttemptAt?: Date; lastError?: string | null }
  ): Promise<boolean> {
    const data: Record<string, unknown> = { status: OutboxMapper.mapStatusToOrm(patch.status) }
    if (patch.retryCount !== undefined) data.retryCount = patch.retryCount
    if (patch.nextAttemptAt !== undefined) data.nextAttemptAt = patch.nextAttemptAt
    if (patch.lastError !== undefined) data.lastError = patch.lastError

    // The status predicate is part of the WHERE, so a concurrent claim simply wins.
    const result = await this.outboxRepo.update({ id, status: In(expectedStatuses.map((status) => OutboxMapper.mapStatusToOrm(status))) }, data)
    return (result.affected ?? 0) > 0
  }

  async retryManyWhileInStatus(ids: string[], expectedStatuses: OutboxStatus[], nextAttemptAt: Date): Promise<string[]> {
    if (ids.length === 0) return []
    const expected = expectedStatuses.map((status) => OutboxMapper.mapStatusToOrm(status))

    // Read the eligible ids first so the caller can report exactly what was skipped.
    const eligible = await this.outboxRepo.find({ where: { id: In(ids), status: In(expected) }, select: { id: true } })
    if (eligible.length === 0) return []

    const eligibleIds = eligible.map((row) => row.id)
    await this.outboxRepo.update(
      { id: In(eligibleIds), status: In(expected) },
      // A fresh allowance: the message gets a complete new retry cycle (T8).
      { status: OutboxMapper.mapStatusToOrm(OutboxStatus.PENDING), retryCount: 0, nextAttemptAt }
    )
    return eligibleIds
  }

  async claimBatch(limit: number, now: Date, staleBefore: Date): Promise<OutboxMessage[]> {
    // FOR UPDATE SKIP LOCKED inside one transaction: concurrent dispatchers never grab the same rows.
    return this.outboxRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(OutboxOrmEntity)
      const rows = await repo
        .createQueryBuilder('outbox')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('(outbox.status = :pending AND outbox.nextAttemptAt <= :now) OR (outbox.status = :processing AND outbox.updatedAt < :staleBefore)', {
          pending: OutboxMapper.mapStatusToOrm(OutboxStatus.PENDING),
          processing: OutboxMapper.mapStatusToOrm(OutboxStatus.PROCESSING),
          now,
          staleBefore,
        })
        .orderBy('outbox.id', 'ASC')
        .take(limit)
        .getMany()

      if (rows.length === 0) return []

      await repo.update({ id: In(rows.map((row) => row.id)) }, { status: OutboxMapper.mapStatusToOrm(OutboxStatus.PROCESSING) })
      return rows.map((row) => OutboxMapper.toDomain(row))
    })
  }

  async appendHandledBy(id: string, handlerKey: string): Promise<void> {
    // jsonb concat is atomic; the row is exclusively claimed (PROCESSING) so no concurrent appender exists.
    await this.outboxRepo
      .createQueryBuilder()
      .update()
      .set({ handledBy: () => `"handledBy" || :appended::jsonb` })
      .where('id = :id', { id })
      .setParameters({ appended: JSON.stringify([handlerKey]) })
      .execute()
  }

  async markPublished(id: string, at: Date, redactedPayload: unknown): Promise<void> {
    // lastError is intentionally kept — a row that succeeded after retries shows what it recovered from.
    await this.outboxRepo.update(
      { id },
      { status: OutboxMapper.mapStatusToOrm(OutboxStatus.PUBLISHED), publishedAt: at, payload: redactedPayload as QueryDeepPartialEntity<OutboxOrmEntity>['payload'] }
    )
  }

  async scheduleRetry(id: string, error: string, nextAttemptAt: Date): Promise<void> {
    await this.outboxRepo.update(
      { id },
      { status: OutboxMapper.mapStatusToOrm(OutboxStatus.PENDING), retryCount: () => '"retryCount" + 1', lastError: error, nextAttemptAt }
    )
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.outboxRepo.update({ id }, { status: OutboxMapper.mapStatusToOrm(OutboxStatus.FAILED), retryCount: () => '"retryCount" + 1', lastError: error })
  }

  async deletePublishedBefore(cutoff: Date): Promise<number> {
    const result = await this.outboxRepo.delete({ status: OutboxMapper.mapStatusToOrm(OutboxStatus.PUBLISHED), publishedAt: LessThan(cutoff) })
    return result.affected ?? 0
  }
}
