import { AuthEvent } from '@domain/auth-event/aggregate/auth-event.aggregate'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { IAuthEventRepository } from '@domain/auth-event/repository/auth-event.repository'
import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { AuthEventMapper } from '@infrastructure/database/auth-event/mapper/auth-event.mapper'
import { AuthEventOrmEntity } from '@infrastructure/database/auth-event/orm-entity/auth-event.orm.entity'
import { findPaginate } from '@infrastructure/database/shared/pagination/pagination.service'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, LessThan, Repository } from 'typeorm'

@Injectable()
export class AuthEventRepositoryImpl implements IAuthEventRepository {
  constructor(
    @InjectRepository(AuthEventOrmEntity)
    private readonly eventRepo: Repository<AuthEventOrmEntity>
  ) {}

  async insertOne(entity: AuthEvent): Promise<AuthEvent> {
    const saved = await this.eventRepo.save(AuthEventMapper.toOrm(entity))
    return AuthEventMapper.toDomain(saved)
  }

  findEvents(query: { limit?: number; page?: number; order?: OrderDirectionEnum; userId?: string; type?: AuthEventType }) {
    const where: FindOptionsWhere<AuthEventOrmEntity> = {}
    if (query.userId !== undefined) where.userId = query.userId
    if (query.type) where.type = AuthEventMapper.mapTypeToOrm(query.type)

    return findPaginate<AuthEventOrmEntity, AuthEvent>({
      repository: this.eventRepo,
      mapper: AuthEventMapper,
      options: { where },
      params: { page: query.page, limit: query.limit, sort: [{ sortBy: 'createdAt', order: query.order ?? OrderDirectionEnum.DESC }] },
    })
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.eventRepo.delete({ createdAt: LessThan(cutoff) })
    return result.affected ?? 0
  }
}
