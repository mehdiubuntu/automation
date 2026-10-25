import { Project } from '@domain/project/aggregate/project.aggregate'
import { ProjectOrmEntity } from '@infrastructure/database/project/orm-entity/project.orm.entity'

export class ProjectMapper {
  static toDomain(entity: ProjectOrmEntity): Project {
    return Project.restore(entity.id, entity.name, entity.code, entity.description ?? null, entity.isActive, entity.createdAt, entity.updatedAt)
  }

  /** Only defined fields are copied, so the result doubles as a partial-update payload. */
  static toOrm(project: Project): ProjectOrmEntity {
    const ormEntity = new ProjectOrmEntity()

    if (project.id !== undefined) ormEntity.id = project.id
    if (project.name !== undefined) ormEntity.name = project.name
    if (project.code !== undefined) ormEntity.code = project.code
    if (project.description !== undefined) ormEntity.description = project.description
    if (project.isActive !== undefined) ormEntity.isActive = project.isActive

    return ormEntity
  }
}
