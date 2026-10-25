import { BaseOrmEntity } from '@infrastructure/database/shared/base/base-orm.entity'
import { Column, Entity } from 'typeorm'

@Entity({ name: 'User' })
export class UserOrmEntity extends BaseOrmEntity {
  @Column({ type: 'varchar', length: 254, unique: true })
  email: string

  @Column({ select: false })
  password: string

  @Column({ type: 'int' })
  role: number

  @Column({ type: 'int' })
  status: number

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null
}
