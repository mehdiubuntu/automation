import { CreateDateColumn, DeleteDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { Exclude } from 'class-transformer'

export abstract class BaseOrmEntity {
  // Postgres 18 generates the id (time-ordered UUIDv7); the app never assigns it on insert.
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string

  @CreateDateColumn({
    name: 'createdAt',
    type: 'timestamptz',
    select: true,
  })
  createdAt: Date

  @UpdateDateColumn({
    name: 'updatedAt',
    type: 'timestamptz',
    select: true,
  })
  @Exclude({ toPlainOnly: true })
  updatedAt: Date

  @DeleteDateColumn({
    name: 'deletedAt',
    type: 'timestamptz',
    select: true,
    nullable: true,
  })
  @Exclude({ toPlainOnly: true })
  deletedAt: Date
}
