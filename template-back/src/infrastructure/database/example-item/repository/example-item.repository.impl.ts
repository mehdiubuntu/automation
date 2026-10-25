import { ExampleItem } from '@domain/example-item/aggregate/example-item.aggregate'
import { IExampleItemRepository } from '@domain/example-item/repository/example-item.repository'
import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { ExampleItemMapper } from '@infrastructure/database/example-item/mapper/example-item.mapper'
import { ExampleItemOrmEntity } from '@infrastructure/database/example-item/orm-entity/example-item.orm.entity'
import { findPaginate } from '@infrastructure/database/shared/pagination/pagination.service'
import { updateAndReturn } from '@infrastructure/database/shared/update/update.service'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, ILike, Repository } from 'typeorm'
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'

@Injectable()
export class ExampleItemRepositoryImpl implements IExampleItemRepository {
  constructor(
    @InjectRepository(ExampleItemOrmEntity)
    private readonly exampleItemRepo: Repository<ExampleItemOrmEntity>
  ) {}

  async insertOne(entity: ExampleItem): Promise<ExampleItem> {
    const saved = await this.exampleItemRepo.save(ExampleItemMapper.toOrm(entity))
    return ExampleItemMapper.toDomain(saved)
  }

  async findById(id: string): Promise<ExampleItem | null> {
    const row = await this.exampleItemRepo.findOne({ where: { id } })
    return row ? ExampleItemMapper.toDomain(row) : null
  }

  async findByNameInProject(projectId: string, name: string): Promise<ExampleItem | null> {
    const row = await this.exampleItemRepo.findOne({ where: { projectId, name } })
    return row ? ExampleItemMapper.toDomain(row) : null
  }

  async findExampleItems(query: Parameters<IExampleItemRepository['findExampleItems']>[0]) {
    const where: FindOptionsWhere<ExampleItemOrmEntity> = { projectId: query.projectId }
    if (query.name) where.name = ILike(`%${query.name.replace(/[%_\\]/g, '\\$&')}%`)
    if (query.isActive !== undefined) where.isActive = query.isActive

    return findPaginate<ExampleItemOrmEntity, ExampleItem>({
      repository: this.exampleItemRepo,
      mapper: ExampleItemMapper,
      options: { where },
      params: { page: query.page, limit: query.limit, sort: [{ sortBy: 'createdAt', order: query.order ?? OrderDirectionEnum.DESC }] },
    })
  }

  async updateById(id: string, entity: ExampleItem): Promise<ExampleItem | null> {
    const orm = ExampleItemMapper.toOrm(entity)
    // Only defined columns: an entity instance would write NULL for every untouched field.
    const data = Object.fromEntries(Object.entries(orm).filter(([, value]) => value !== undefined)) as QueryDeepPartialEntity<ExampleItemOrmEntity>

    const row = await updateAndReturn({ repository: this.exampleItemRepo, where: { id }, data })
    return row ? ExampleItemMapper.toDomain(row) : null
  }

  async softDeleteById(id: string): Promise<boolean> {
    const result = await this.exampleItemRepo.softDelete({ id })
    return (result.affected ?? 0) > 0
  }
}
