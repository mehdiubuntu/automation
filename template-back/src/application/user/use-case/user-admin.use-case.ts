import { AuthEventService } from '@application/auth/service/auth-event.service'
import { ISessionView, SessionService } from '@application/auth/service/session.service'
import { IGetAuthEventsPaginateInput, IGetUsersPaginateInput } from '@application/user/interface/user.input.interface'
import { AuthUser } from '@domain/auth/type/auth-user.type'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { AUTH_EVENT_REPOSITORY_TOKEN, type IAuthEventRepository } from '@domain/auth-event/repository/auth-event.repository'
import { SESSION_REPOSITORY_TOKEN, type ISessionRepository } from '@domain/session/repository/session.repository'
import { DeviceContext } from '@domain/session/service/device-info'
import { GenericException } from '@domain/shared/error/base-http.exception'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'
import { UNIT_OF_WORK_TOKEN, type UnitOfWork } from '@domain/shared/unit-of-work/unit-of-work.interface'
import { User } from '@domain/user/aggregate/user.aggregate'
import { UserStatus } from '@domain/user/enum/user.enum'
import { USER_REPOSITORY_TOKEN, type IUserRepository } from '@domain/user/repository/user.repository'
import { Inject, Injectable } from '@nestjs/common'

type UserView = ReturnType<User['toPrimitives']>

interface Transition {
  from: UserStatus[]
  to: UserStatus
  event: AuthEventType
  revokeSessions: boolean
}

const APPROVE: Transition = { from: [UserStatus.PENDING_APPROVAL], to: UserStatus.ACTIVE, event: AuthEventType.APPROVED, revokeSessions: false }
const REJECT: Transition = { from: [UserStatus.PENDING_APPROVAL], to: UserStatus.BLOCKED, event: AuthEventType.REJECTED, revokeSessions: true }
const BLOCK: Transition = { from: [UserStatus.ACTIVE, UserStatus.PENDING_APPROVAL], to: UserStatus.BLOCKED, event: AuthEventType.BLOCKED, revokeSessions: true }
const UNBLOCK: Transition = { from: [UserStatus.BLOCKED], to: UserStatus.ACTIVE, event: AuthEventType.UNBLOCKED, revokeSessions: false }

/** Super administrator operations over accounts. The super administrator account itself is never touched through them. */
@Injectable()
export class UserAdminUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private readonly users: IUserRepository,
    @Inject(SESSION_REPOSITORY_TOKEN) private readonly sessions: ISessionRepository,
    @Inject(AUTH_EVENT_REPOSITORY_TOKEN) private readonly authEvents: IAuthEventRepository,
    @Inject(UNIT_OF_WORK_TOKEN) private readonly uow: UnitOfWork,
    private readonly sessionService: SessionService,
    private readonly events: AuthEventService
  ) {}

  async getUsers(input: IGetUsersPaginateInput): Promise<IPaginatedResponse<UserView>> {
    const result = await this.users.findUsers(input)
    return { data: result.data.map((user) => user.toPrimitives()), meta: result.meta }
  }

  approveUser(actor: AuthUser, id: string, device: DeviceContext): Promise<UserView> {
    return this.transition(actor, id, APPROVE, device)
  }

  rejectUser(actor: AuthUser, id: string, device: DeviceContext): Promise<UserView> {
    return this.transition(actor, id, REJECT, device)
  }

  blockUser(actor: AuthUser, id: string, device: DeviceContext): Promise<UserView> {
    return this.transition(actor, id, BLOCK, device)
  }

  unblockUser(actor: AuthUser, id: string, device: DeviceContext): Promise<UserView> {
    return this.transition(actor, id, UNBLOCK, device)
  }

  async getUserSessions(userId: string): Promise<Array<ISessionView & { userAgent: string | null }>> {
    await this.mustGetUser(userId)
    const live = await this.sessionService.listLive(userId, new Date())
    return live.map((session) => ({ ...this.sessionService.toView(session), userAgent: session.userAgent ?? null }))
  }

  async revokeUserSessions(actor: AuthUser, userId: string, device: DeviceContext): Promise<{ revoked: number }> {
    this.assertNotSuperAdmin(await this.mustGetUser(userId))
    const revoked = await this.sessions.revokeAllByUser(userId, new Date())
    await this.events.record({ type: AuthEventType.SESSION_REVOKED, userId, actorUserId: actor.userId, device })
    return { revoked }
  }

  async getAuthEvents(input: IGetAuthEventsPaginateInput) {
    const result = await this.authEvents.findEvents(input)
    return { data: result.data.map((event) => event.toPrimitives()), meta: result.meta }
  }

  private async transition(actor: AuthUser, id: string, rule: Transition, device: DeviceContext): Promise<UserView> {
    const user = await this.mustGetUser(id)
    this.assertNotSuperAdmin(user)
    if (!rule.from.includes(user.status!)) {
      throw new GenericException(`This action is not allowed for a user in status ${user.status}.`, 409, 'USER', 'USER_002')
    }

    await this.uow.execute(async () => {
      await this.users.updateStatus(id, rule.to)
      if (rule.revokeSessions) await this.sessions.revokeAllByUser(id, new Date())
      await this.events.record({ type: rule.event, userId: id, actorUserId: actor.userId, device })
    })
    user.status = rule.to
    return user.toPrimitives()
  }

  private async mustGetUser(id: string): Promise<User> {
    const user = await this.users.findById(id)
    if (!user) {
      throw new GenericException('User not found.', 404, 'USER', 'USER_001')
    }
    return user
  }

  private assertNotSuperAdmin(user: User): void {
    if (user.isSuperAdmin()) {
      throw new GenericException('The super administrator account cannot be modified.', 403, 'USER', 'USER_003')
    }
  }
}
