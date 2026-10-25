import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { User } from '@domain/user/aggregate/user.aggregate'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'
import { IUserRepository } from '@domain/user/repository/user.repository'
import { findPaginate } from '@infrastructure/database/shared/pagination/pagination.service'
import { UserMapper } from '@infrastructure/database/user/mapper/user.mapper'
import { UserOrmEntity } from '@infrastructure/database/user/orm-entity/user.orm.entity'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, ILike, Not, Repository } from 'typeorm'

@Injectable()
export class UserRepositoryImpl implements IUserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly userRepo: Repository<UserOrmEntity>
  ) {}

  async insertOne(entity: User): Promise<User> {
    const saved = await this.userRepo.save(UserMapper.toOrm(entity))
    return UserMapper.toDomain(saved)
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.userRepo.findOne({ where: { id } })
    return row ? UserMapper.toDomain(row) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.userRepo.findOne({ where: { email } })
    return row ? UserMapper.toDomain(row) : null
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    const row = await this.userRepo.createQueryBuilder('user').addSelect('user.password').where('user.email = :email', { email }).getOne()
    return row ? UserMapper.toDomain(row) : null
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    const row = await this.userRepo.createQueryBuilder('user').addSelect('user.password').where('user.id = :id', { id }).getOne()
    return row ? UserMapper.toDomain(row) : null
  }

  async findUsers(query: { limit?: number; page?: number; order?: OrderDirectionEnum; status?: UserStatus; search?: string }) {
    const base: FindOptionsWhere<UserOrmEntity> = {}
    if (query.status) base.status = UserMapper.mapStatusToOrm(query.status)
    const search = query.search?.trim()
    const where = search ? { ...base, email: ILike(`%${search.replace(/[%_\\]/g, '\\$&')}%`) } : base

    return findPaginate<UserOrmEntity, User>({
      repository: this.userRepo,
      mapper: UserMapper,
      options: { where },
      params: { page: query.page, limit: query.limit, sort: [{ sortBy: 'createdAt', order: query.order ?? OrderDirectionEnum.DESC }] },
    })
  }

  async updateStatus(id: string, status: UserStatus): Promise<void> {
    await this.userRepo.update({ id }, { status: UserMapper.mapStatusToOrm(status) })
  }

  async markEmailVerified(id: string, status: UserStatus, at: Date): Promise<void> {
    await this.userRepo.update({ id }, { status: UserMapper.mapStatusToOrm(status), emailVerifiedAt: at })
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.userRepo.update({ id }, { password: passwordHash, failedLoginAttempts: 0, lockedUntil: null })
  }

  async incrementFailedLogins(id: string): Promise<number> {
    const result = await this.userRepo
      .createQueryBuilder()
      .update(UserOrmEntity)
      .set({ failedLoginAttempts: () => '"failedLoginAttempts" + 1' })
      .where('id = :id', { id })
      .returning('"failedLoginAttempts"')
      .execute()
    return (result.raw as Array<{ failedLoginAttempts: number }>)[0]?.failedLoginAttempts ?? 0
  }

  async lock(id: string, until: Date): Promise<void> {
    await this.userRepo.update({ id }, { lockedUntil: until, failedLoginAttempts: 0 })
  }

  async recordSuccessfulLogin(id: string, at: Date): Promise<void> {
    await this.userRepo.update({ id }, { lastLoginAt: at, failedLoginAttempts: 0, lockedUntil: null })
  }

  async syncSuperAdmin(id: string, passwordHash: string | undefined, at: Date): Promise<void> {
    await this.userRepo.update(
      { id },
      {
        role: UserMapper.mapRoleToOrm(UserRole.SUPERADMIN),
        status: UserMapper.mapStatusToOrm(UserStatus.ACTIVE),
        emailVerifiedAt: at,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(passwordHash ? { password: passwordHash } : {}),
      }
    )
  }

  async findSuperAdminsExcept(email: string): Promise<User[]> {
    const rows = await this.userRepo.find({ where: { role: UserMapper.mapRoleToOrm(UserRole.SUPERADMIN), email: Not(email) } })
    return rows.map((row) => UserMapper.toDomain(row))
  }

  async updateRole(id: string, role: UserRole): Promise<void> {
    await this.userRepo.update({ id }, { role: UserMapper.mapRoleToOrm(role) })
  }
}
