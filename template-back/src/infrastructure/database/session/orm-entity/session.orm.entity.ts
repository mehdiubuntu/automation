import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm'

@Entity({ name: 'Session' })
export class SessionOrmEntity {
  // The app supplies the id (it is inside the refresh token before the row exists); the default is the fallback.
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string

  @Index()
  @Column({ type: 'uuid' })
  userId: string

  /** sha256 of the current refresh token. */
  @Column({ type: 'varchar', length: 64 })
  refreshTokenHash: string

  /** sha256 of the refresh token replaced by the last rotation (reuse detection). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  rotatedFrom: string | null

  @Column({ type: 'timestamptz', nullable: true })
  rotatedAt: Date | null

  @Column({ type: 'timestamptz' })
  expiresAt: Date

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceLabel: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @Column({ type: 'timestamptz' })
  lastActiveAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null
}
