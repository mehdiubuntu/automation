import { Session } from '@domain/session/aggregate/session.aggregate'
import { SessionOrmEntity } from '@infrastructure/database/session/orm-entity/session.orm.entity'

export class SessionMapper {
  static toDomain(entity: SessionOrmEntity): Session {
    return new Session(
      entity.id,
      entity.userId,
      entity.refreshTokenHash,
      entity.expiresAt,
      entity.ip ?? undefined,
      entity.userAgent ?? undefined,
      entity.deviceLabel ?? undefined,
      entity.createdAt,
      entity.lastActiveAt,
      entity.revokedAt ?? null,
      entity.rotatedFrom ?? null,
      entity.rotatedAt ?? null
    )
  }

  static toOrm(session: Session): SessionOrmEntity {
    const ormEntity = new SessionOrmEntity()

    ormEntity.id = session.id
    ormEntity.userId = session.userId
    ormEntity.refreshTokenHash = session.tokenHash
    ormEntity.expiresAt = session.expiresAt
    ormEntity.ip = session.ip ?? null
    ormEntity.userAgent = session.userAgent ?? null
    ormEntity.deviceLabel = session.deviceLabel ?? null
    ormEntity.createdAt = session.createdAt
    ormEntity.lastActiveAt = session.lastActiveAt
    ormEntity.revokedAt = session.revokedAt
    ormEntity.rotatedFrom = session.rotatedFrom
    ormEntity.rotatedAt = session.rotatedAt

    return ormEntity
  }
}
