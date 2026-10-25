import { AuthEvent } from '@domain/auth-event/aggregate/auth-event.aggregate'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { AUTH_EVENT_REPOSITORY_TOKEN, type IAuthEventRepository } from '@domain/auth-event/repository/auth-event.repository'
import { DeviceContext } from '@domain/session/service/device-info'
import { Inject, Injectable } from '@nestjs/common'

/** Writes the auth audit trail. Never pass secrets (passwords, codes, tokens) - only who, what and from where. */
@Injectable()
export class AuthEventService {
  constructor(
    @Inject(AUTH_EVENT_REPOSITORY_TOKEN)
    private readonly events: IAuthEventRepository
  ) {}

  async record(input: { type: AuthEventType; userId?: string | null; actorUserId?: string | null; device?: DeviceContext }): Promise<void> {
    await this.events.insertOne(
      AuthEvent.create({ type: input.type, userId: input.userId, actorUserId: input.actorUserId, ip: input.device?.ip, userAgent: input.device?.userAgent })
    )
  }
}
