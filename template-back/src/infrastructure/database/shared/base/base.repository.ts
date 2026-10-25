import { IMapperStatic } from '@infrastructure/database/shared/base/mapper.interface'
import { updateAndReturn } from '@infrastructure/database/shared/update/update.service'
import { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm'

export abstract class BaseRepository<TDomain, TOrm extends ObjectLiteral> {
  constructor(
    protected readonly repository: Repository<TOrm>,
    protected readonly mapper: IMapperStatic<TDomain, TOrm>
  ) {}

  async save(entity: TDomain): Promise<TDomain> {
    const orm = this.mapper.toOrm(entity)
    const saved = await this.repository.save(orm)
    return this.mapper.toDomain(saved)
  }

  async findOne(where: FindOptionsWhere<TOrm>): Promise<TDomain | null> {
    const ormWhere = this.convertWhere(where)
    const orm = await this.repository.findOne({ where: ormWhere })
    return orm ? this.mapper.toDomain(orm) : null
  }

  async update(where: FindOptionsWhere<TOrm>, entity: TDomain): Promise<TDomain | null> {
    const ormWhere = this.convertWhere(where)
    const result = await updateAndReturn({
      repository: this.repository,
      where: ormWhere,
      data: this.mapper.toOrm(entity),
    })
    return result ? this.mapper.toDomain(result) : null
  }

  async delete(where: FindOptionsWhere<TOrm>): Promise<number | null | undefined> {
    const ormWhere = this.convertWhere(where)
    const result = await this.repository.delete(ormWhere)

    return result.affected
  }

  private convertWhere(where: FindOptionsWhere<TOrm>): FindOptionsWhere<TOrm> {
    if (!this.mapper.toOrmField) return where
    const converted = {} as FindOptionsWhere<TOrm>
    for (const key in where) {
      const value = where[key]
      ;(converted as any)[key] = this.mapper.toOrmField(key, value)
    }
    return converted
  }
}
