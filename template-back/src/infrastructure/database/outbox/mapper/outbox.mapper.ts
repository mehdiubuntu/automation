import { OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { OutboxAggregateType, OutboxEventType, OutboxStatus } from '@domain/outbox/enum/outbox.enum'
import { OutboxOrmEntity } from '@infrastructure/database/outbox/orm-entity/outbox.orm.entity'

const STATUS_TO_ORM: Record<OutboxStatus, number> = {
  [OutboxStatus.PENDING]: 1,
  [OutboxStatus.PROCESSING]: 2,
  [OutboxStatus.PUBLISHED]: 3,
  [OutboxStatus.FAILED]: 4,
  [OutboxStatus.CANCELLED]: 5,
}

const STATUS_TO_DOMAIN: Record<number, OutboxStatus> = {
  1: OutboxStatus.PENDING,
  2: OutboxStatus.PROCESSING,
  3: OutboxStatus.PUBLISHED,
  4: OutboxStatus.FAILED,
  5: OutboxStatus.CANCELLED,
}

export class OutboxMapper {
  static toDomain(entity: OutboxOrmEntity): OutboxMessage {
    return OutboxMessage.restore(
      entity.id,
      entity.aggregateType as OutboxAggregateType,
      entity.aggregateId,
      entity.eventType as OutboxEventType,
      entity.payload,
      this.mapStatusToDomain(entity.status),
      entity.retryCount,
      entity.lastError ?? undefined,
      entity.nextAttemptAt,
      entity.publishedAt ?? undefined,
      entity.createdAt,
      entity.handledBy ?? []
    )
  }

  static toOrm(message: OutboxMessage): OutboxOrmEntity {
    const primitives = message.toPrimitives()
    const ormEntity = new OutboxOrmEntity()

    if (primitives.id !== undefined) ormEntity.id = primitives.id
    if (primitives.aggregateType !== undefined) ormEntity.aggregateType = primitives.aggregateType
    if (primitives.aggregateId !== undefined) ormEntity.aggregateId = primitives.aggregateId
    if (primitives.eventType !== undefined) ormEntity.eventType = primitives.eventType
    if (primitives.payload !== undefined) ormEntity.payload = primitives.payload
    if (primitives.status !== undefined) ormEntity.status = this.mapStatusToOrm(primitives.status)
    if (primitives.retryCount !== undefined) ormEntity.retryCount = primitives.retryCount
    if (primitives.lastError !== undefined) ormEntity.lastError = primitives.lastError
    if (primitives.nextAttemptAt !== undefined) ormEntity.nextAttemptAt = primitives.nextAttemptAt
    if (primitives.publishedAt !== undefined) ormEntity.publishedAt = primitives.publishedAt
    if (primitives.handledBy !== undefined) ormEntity.handledBy = primitives.handledBy

    return ormEntity
  }

  static mapStatusToOrm(status: OutboxStatus): number {
    return STATUS_TO_ORM[status]
  }

  static mapStatusToDomain(status: number): OutboxStatus {
    return STATUS_TO_DOMAIN[status]
  }
}
