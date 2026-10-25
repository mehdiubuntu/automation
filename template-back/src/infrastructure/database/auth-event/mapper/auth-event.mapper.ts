import { AuthEvent } from '@domain/auth-event/aggregate/auth-event.aggregate'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { AuthEventOrmEntity } from '@infrastructure/database/auth-event/orm-entity/auth-event.orm.entity'

// Stable DB codes (position + 1): append only, never reorder.
const TYPE_ORDER: AuthEventType[] = [
  AuthEventType.REGISTERED,
  AuthEventType.EMAIL_VERIFIED,
  AuthEventType.LOGIN_SUCCESS,
  AuthEventType.LOGIN_FAILED,
  AuthEventType.LOCKED,
  AuthEventType.LOGOUT,
  AuthEventType.SESSION_REVOKED,
  AuthEventType.PASSWORD_CHANGED,
  AuthEventType.PASSWORD_RESET,
  AuthEventType.APPROVED,
  AuthEventType.REJECTED,
  AuthEventType.BLOCKED,
  AuthEventType.UNBLOCKED,
]

export class AuthEventMapper {
  static toDomain(entity: AuthEventOrmEntity): AuthEvent {
    return AuthEvent.restore(
      entity.id,
      entity.userId ?? null,
      entity.actorUserId ?? null,
      TYPE_ORDER[entity.type - 1],
      entity.ip ?? null,
      entity.userAgent ?? null,
      entity.createdAt
    )
  }

  static toOrm(event: AuthEvent): AuthEventOrmEntity {
    const ormEntity = new AuthEventOrmEntity()

    ormEntity.userId = event.userId ?? null
    ormEntity.actorUserId = event.actorUserId ?? null
    ormEntity.type = this.mapTypeToOrm(event.type!)
    ormEntity.ip = event.ip ?? null
    ormEntity.userAgent = event.userAgent ?? null

    return ormEntity
  }

  static mapTypeToOrm(type: AuthEventType): number {
    return TYPE_ORDER.indexOf(type) + 1
  }
}
