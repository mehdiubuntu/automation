import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'

export const AUTH_EVENT_USER_AGENT_MAX = 255

export class AuthEvent {
  constructor(
    public id?: string,
    public userId?: string | null,
    public actorUserId?: string | null,
    public type?: AuthEventType,
    public ip?: string | null,
    public userAgent?: string | null,
    public createdAt?: Date
  ) {}

  /** `actorUserId` is the administrator behind an admin action (APPROVED, BLOCKED, ...). No secrets ever go in here. */
  static create(props: { type: AuthEventType; userId?: string | null; actorUserId?: string | null; ip?: string; userAgent?: string }): AuthEvent {
    return new AuthEvent(
      undefined,
      props.userId ?? null,
      props.actorUserId ?? null,
      props.type,
      props.ip ?? null,
      props.userAgent?.slice(0, AUTH_EVENT_USER_AGENT_MAX) ?? null
    )
  }

  static restore(
    id: string,
    userId: string | null,
    actorUserId: string | null,
    type: AuthEventType,
    ip: string | null,
    userAgent: string | null,
    createdAt: Date
  ): AuthEvent {
    return new AuthEvent(id, userId, actorUserId, type, ip, userAgent, createdAt)
  }

  toPrimitives() {
    return { id: this.id, userId: this.userId, actorUserId: this.actorUserId, type: this.type, ip: this.ip, userAgent: this.userAgent, createdAt: this.createdAt }
  }
}
