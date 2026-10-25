import { Project } from '@domain/project/aggregate/project.aggregate'
import { IProjectRepository } from '@domain/project/repository/project.repository'
import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { ProjectMapper } from '@infrastructure/database/project/mapper/project.mapper'
import { ProjectOrmEntity } from '@infrastructure/database/project/orm-entity/project.orm.entity'
import { findPaginate } from '@infrastructure/database/shared/pagination/pagination.service'
import { updateAndReturn } from '@infrastructure/database/shared/update/update.service'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, ILike, Repository } from 'typeorm'
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'

@Injectable()
export class ProjectRepositoryImpl implements IProjectRepository {
  constructor(
    @InjectRepository(ProjectOrmEntity)
    private readonly projectRepo: Repository<ProjectOrmEntity>
  ) {}

  async insertOne(entity: Project): Promise<Project> {
    const saved = await this.projectRepo.save(ProjectMapper.toOrm(entity))
    return ProjectMapper.toDomain(saved)
  }

  async findById(id: string): Promise<Project | null> {
    const row = await this.projectRepo.findOne({ where: { id } })
    return row ? ProjectMapper.toDomain(row) : null
  }

  async findByName(name: string): Promise<Project | null> {
    const row = await this.projectRepo.findOne({ where: { name } })
    return row ? ProjectMapper.toDomain(row) : null
  }

  async findByCode(code: string): Promise<Project | null> {
    const row = await this.projectRepo.findOne({ where: { code } })
    return row ? ProjectMapper.toDomain(row) : null
  }

  async findProjects(query: Parameters<IProjectRepository['findProjects']>[0]) {
    const base: FindOptionsWhere<ProjectOrmEntity> = {}
    if (query.isActive !== undefined) base.isActive = query.isActive
    const search = query.search?.trim()
    const term = search ? `%${search.replace(/[%_\\]/g, '\\$&')}%` : undefined
    const where = term
      ? [
          { ...base, name: ILike(term) },
          { ...base, code: ILike(term) },
        ]
      : base

    return findPaginate<ProjectOrmEntity, Project>({
      repository: this.projectRepo,
      mapper: ProjectMapper,
      options: { where },
      params: { page: query.page, limit: query.limit, sort: [{ sortBy: 'createdAt', order: query.order ?? OrderDirectionEnum.DESC }] },
    })
  }

  async updateById(id: string, entity: Project): Promise<Project | null> {
    const orm = ProjectMapper.toOrm(entity)
    // Only defined columns: an entity instance would write NULL for every untouched field.
    const data = Object.fromEntries(Object.entries(orm).filter(([, value]) => value !== undefined)) as QueryDeepPartialEntity<ProjectOrmEntity>

    const row = await updateAndReturn({ repository: this.projectRepo, where: { id }, data })
    return row ? ProjectMapper.toDomain(row) : null
  }

  async softDeleteById(id: string): Promise<boolean> {
    const result = await this.projectRepo.softDelete({ id })
    return (result.affected ?? 0) > 0
  }
}
