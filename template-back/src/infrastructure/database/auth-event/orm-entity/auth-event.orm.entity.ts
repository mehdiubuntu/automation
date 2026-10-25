import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm'

@Entity({ name: 'AuthEvent' })
@Index(['userId', 'createdAt'])
@Index(['createdAt'])
export class AuthEventOrmEntity {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string

  @Column({ type: 'uuid', nullable: true })
  userId: string | null

  /** The administrator behind an admin action; null for self-service events. */
  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null

  @Column({ type: 'int' })
  type: number

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date
}
