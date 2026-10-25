import { BaseOrmEntity } from '@infrastructure/database/shared/base/base-orm.entity'
import { Column, Entity, Index } from 'typeorm'

@Entity({ name: 'Otp' })
@Index(['userId', 'purpose', 'createdAt'])
export class OtpOrmEntity extends BaseOrmEntity {
  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'int' })
  purpose: number

  /** HMAC-SHA256 hex digest - the code itself is never stored. */
  @Column({ type: 'varchar', length: 64 })
  codeHash: string

  @Column({ type: 'timestamptz' })
  expiresAt: Date

  @Column({ type: 'int', default: 0 })
  attempts: number

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null
}
