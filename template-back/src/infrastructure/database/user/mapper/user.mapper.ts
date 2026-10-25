import { User } from '@domain/user/aggregate/user.aggregate'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'
import { UserOrmEntity } from '@infrastructure/database/user/orm-entity/user.orm.entity'

const STATUS_TO_ORM: Record<UserStatus, number> = {
  [UserStatus.PENDING_VERIFICATION]: 1,
  [UserStatus.PENDING_APPROVAL]: 2,
  [UserStatus.ACTIVE]: 3,
  [UserStatus.BLOCKED]: 4,
}

const ROLE_TO_ORM: Record<UserRole, number> = {
  [UserRole.SUPERADMIN]: 1,
  [UserRole.SPARTAN]: 2,
}

const invert = <K extends string>(map: Record<K, number>): Record<number, K> =>
  Object.fromEntries((Object.entries(map) as Array<[K, number]>).map(([key, value]) => [value, key]))

const STATUS_TO_DOMAIN = invert(STATUS_TO_ORM)
const ROLE_TO_DOMAIN = invert(ROLE_TO_ORM)

export class UserMapper {
  static toDomain(entity: UserOrmEntity): User {
    return User.restore(
      entity.id,
      entity.email,
      entity.password,
      this.mapRoleToDomain(entity.role),
      this.mapStatusToDomain(entity.status),
      entity.emailVerifiedAt ?? null,
      entity.failedLoginAttempts ?? 0,
      entity.lockedUntil ?? null,
      entity.lastLoginAt ?? null,
      entity.createdAt
    )
  }

  /** Only defined fields are copied (the result is also usable as a partial payload). */
  static toOrm(user: User): UserOrmEntity {
    const ormEntity = new UserOrmEntity()

    if (user.id !== undefined) ormEntity.id = user.id
    if (user.email !== undefined) ormEntity.email = user.email
    if (user.password !== undefined) ormEntity.password = user.password
    if (user.role !== undefined) ormEntity.role = this.mapRoleToOrm(user.role)
    if (user.status !== undefined) ormEntity.status = this.mapStatusToOrm(user.status)
    if (user.emailVerifiedAt !== undefined) ormEntity.emailVerifiedAt = user.emailVerifiedAt
    if (user.failedLoginAttempts !== undefined) ormEntity.failedLoginAttempts = user.failedLoginAttempts
    if (user.lockedUntil !== undefined) ormEntity.lockedUntil = user.lockedUntil
    if (user.lastLoginAt !== undefined) ormEntity.lastLoginAt = user.lastLoginAt

    return ormEntity
  }

  static mapStatusToOrm(status: UserStatus): number {
    return STATUS_TO_ORM[status]
  }

  static mapStatusToDomain(status: number): UserStatus {
    return STATUS_TO_DOMAIN[status]
  }

  static mapRoleToOrm(role: UserRole): number {
    return ROLE_TO_ORM[role]
  }

  static mapRoleToDomain(role: number): UserRole {
    return ROLE_TO_DOMAIN[role]
  }
}
