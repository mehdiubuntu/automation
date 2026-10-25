import { AuthErrors } from '@application/auth/error/auth.errors'
import { ILoginInput } from '@application/auth/interface/auth.input.interface'
import { ILoginResult } from '@application/auth/interface/auth-result.interface'
import { AuthEventService } from '@application/auth/service/auth-event.service'
import { SessionService } from '@application/auth/service/session.service'
import { AUTH_SETTINGS_TOKEN, type IAuthSettings } from '@domain/auth/contract/auth-settings.contract'
import { PASSWORD_HASHER_TOKEN, type IPasswordHasher } from '@domain/auth/contract/password-hasher.contract'
import { toAuthUserView } from '@domain/auth/type/auth-user.type'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { DeviceContext } from '@domain/session/service/device-info'
import { UNIT_OF_WORK_TOKEN, type UnitOfWork } from '@domain/shared/unit-of-work/unit-of-work.interface'
import { User } from '@domain/user/aggregate/user.aggregate'
import { UserStatus } from '@domain/user/enum/user.enum'
import { USER_REPOSITORY_TOKEN, type IUserRepository } from '@domain/user/repository/user.repository'
import { normalizeEmail } from '@domain/user/util/email.util'
import { Inject, Injectable, OnModuleInit } from '@nestjs/common'

const DUMMY_PASSWORD = 'timing-equalizer-not-a-real-password'

@Injectable()
export class LoginUseCase implements OnModuleInit {
  private dummyHash?: Promise<string>

  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER_TOKEN) private readonly hasher: IPasswordHasher,
    @Inject(UNIT_OF_WORK_TOKEN) private readonly uow: UnitOfWork,
    @Inject(AUTH_SETTINGS_TOKEN) private readonly settings: IAuthSettings,
    private readonly sessions: SessionService,
    private readonly events: AuthEventService
  ) {}

  onModuleInit(): void {
    void this.getDummyHash()
  }

  /**
   * Unknown email and wrong password are the same error and cost the same time. Only after the password
   * was proven correct may the caller learn why the account cannot sign in (locked, unverified, pending, blocked).
   */
  async login(input: ILoginInput, device: DeviceContext): Promise<ILoginResult> {
    const user = await this.users.findByEmailWithPassword(normalizeEmail(input.email))
    if (!user?.password) {
      await this.hasher.compare(input.password, await this.getDummyHash())
      await this.events.record({ type: AuthEventType.LOGIN_FAILED, device })
      throw AuthErrors.invalidCredentials()
    }

    const now = new Date()
    const passwordMatches = await this.hasher.compare(input.password, user.password)
    if (!passwordMatches) {
      await this.registerFailure(user, now, device)
      throw AuthErrors.invalidCredentials()
    }

    this.assertCanSignIn(user, now)
    return this.uow.execute(async () => {
      const tokens = await this.sessions.start(user, device, now)
      await this.users.recordSuccessfulLogin(user.id!, now)
      await this.events.record({ type: AuthEventType.LOGIN_SUCCESS, userId: user.id, device })
      return { user: toAuthUserView({ userId: user.id!, email: user.email!, role: user.role!, status: user.status! }), ...tokens }
    })
  }

  private assertCanSignIn(user: User, now: Date): void {
    if (user.isLocked(now)) throw AuthErrors.locked()
    switch (user.status) {
      case UserStatus.PENDING_VERIFICATION:
        throw AuthErrors.emailNotVerified()
      case UserStatus.PENDING_APPROVAL:
        throw AuthErrors.pendingApproval()
      case UserStatus.BLOCKED:
        throw AuthErrors.blocked()
      case UserStatus.ACTIVE:
        return
      default:
        throw AuthErrors.invalidCredentials()
    }
  }

  /** Counts the failure atomically; while an account is already locked the counter is left alone (no lockout extension). */
  private async registerFailure(user: User, now: Date, device: DeviceContext): Promise<void> {
    await this.events.record({ type: AuthEventType.LOGIN_FAILED, userId: user.id, device })
    if (user.isLocked(now)) return

    const failures = await this.users.incrementFailedLogins(user.id!)
    if (failures >= this.settings.maxFailedLogins) {
      await this.users.lock(user.id!, new Date(now.getTime() + this.settings.lockoutMinutes * 60 * 1000))
      await this.events.record({ type: AuthEventType.LOCKED, userId: user.id, device })
    }
  }

  /** A real hash of a throwaway password, built lazily at the configured cost, so unknown emails pay the same bcrypt price. */
  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(DUMMY_PASSWORD)
    return this.dummyHash
  }
}
