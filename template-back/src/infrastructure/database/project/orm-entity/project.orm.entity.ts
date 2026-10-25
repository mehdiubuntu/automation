import { BaseOrmEntity } from '@infrastructure/database/shared/base/base-orm.entity'
import { Column, Entity, Index } from 'typeorm'

@Entity({ name: 'Project' })
// Unique among live rows only: a soft-deleted project frees its name and code.
@Index(['name'], { unique: true, where: '"deletedAt" IS NULL' })
@Index(['code'], { unique: true, where: '"deletedAt" IS NULL' })
export class ProjectOrmEntity extends BaseOrmEntity {
  @Column({ type: 'varchar', length: 120 })
  name: string

  @Column({ type: 'varchar', length: 32 })
  code: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'boolean', default: true })
  isActive: boolean
}
