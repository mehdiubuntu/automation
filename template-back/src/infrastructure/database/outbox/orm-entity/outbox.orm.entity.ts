import { BaseOrmEntity } from '@infrastructure/database/shared/base/base-orm.entity'
import { Column, Entity, Index } from 'typeorm'

@Entity({ name: 'Outbox' })
@Index(['status', 'nextAttemptAt'])
export class OutboxOrmEntity extends BaseOrmEntity {
  @Column()
  aggregateType: string

  @Column()
  aggregateId: string

  @Column()
  eventType: string

  @Column({ type: 'jsonb' })
  payload: unknown

  @Column({ type: 'int' })
  status: number

  @Column({ type: 'int', default: 0 })
  retryCount: number

  @Column({ type: 'text', nullable: true })
  lastError: string

  @Column({ type: 'timestamptz' })
  nextAttemptAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date

  @Column({ type: 'jsonb', default: () => "'[]'" })
  handledBy: string[]
}
