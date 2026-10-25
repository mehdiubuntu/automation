import { ProjectOrmEntity } from '@infrastructure/database/project/orm-entity/project.orm.entity'
import { BaseOrmEntity } from '@infrastructure/database/shared/base/base-orm.entity'
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'

@Entity({ name: 'ExampleItem' })
@Index(['projectId'])
// Unique per project among live rows only: a soft-deleted name can be reused.
@Index(['projectId', 'name'], { unique: true, where: '"deletedAt" IS NULL' })
export class ExampleItemOrmEntity extends BaseOrmEntity {
  @Column({ type: 'uuid' })
  projectId: string

  @ManyToOne(() => ProjectOrmEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'projectId' })
  project?: ProjectOrmEntity

  @Column({ type: 'varchar', length: 120 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'boolean', default: true })
  isActive: boolean
}
