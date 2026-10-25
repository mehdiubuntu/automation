import { AuthErrors } from '@application/auth/error/auth.errors'
import { IChangePasswordInput, IEmailOnlyInput, IResetPasswordInput } from '@application/auth/interface/auth.input.interface'
import { AuthEventService } from '@application/auth/service/auth-event.service'
import { OtpService } from '@application/auth/service/otp.service'
import { holdMinimumDuration } from '@application/shared/util/response-time.util'
import { AUTH_SETTINGS_TOKEN, type IAuthSettings } from '@domain/auth/contract/auth-settings.contract'
import { PASSWORD_HASHER_TOKEN, type IPasswordHasher } from '@domain/auth/contract/password-hasher.contract'
import { passwordPolicyViolations } from '@domain/auth/policy/password.policy'
import { AuthUser } from '@domain/auth/type/auth-user.type'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { OtpPurpose } from '@domain/otp/enum/otp.enum'
import { OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { OUTBOX_REPOSITORY_TOKEN, type IOutboxRepository } from '@domain/outbox/repository/outbox.repository'
import { SESSION_REPOSITORY_TOKEN, type ISessionRepository } from '@domain/session/repository/session.repository'
import { DeviceContext } from '@domain/session/service/device-info'
import { UNIT_OF_WORK_TOKEN, type UnitOfWork } from '@domain/shared/unit-of-work/unit-of-work.interface'
import { User } from '@domain/user/aggregate/user.aggregate'
import { UserStatus } from '@domain/user/enum/user.enum'
import { USER_REPOSITORY_TOKEN, type IUserRepository } from '@domain/user/repository/user.repository'
import { normalizeEmail } from '@domain/user/util/email.util'
import { Inject, Injectable } from '@nestjs/common'

const RESETTABLE_STATUSES: UserStatus[] = [UserStatus.ACTIVE, UserStatus.PENDING_APPROVAL]

@Injectable()
export class PasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private readonly users: IUserRepository,
    @Inject(SESSION_REPOSITORY_TOKEN) private readonly sessions: ISessionRepository,
    @Inject(PASSWORD_HASHER_TOKEN) private readonly hasher: IPasswordHasher,
    @Inject(OUTBOX_REPOSITORY_TOKEN) private readonly outbox: IOutboxRepository,
    @Inject(UNIT_OF_WORK_TOKEN) private readonly uow: UnitOfWork,
    @Inject(AUTH_SETTINGS_TOKEN) private readonly settings: IAuthSettings,
    private readonly otp: OtpService,
    private readonly events: AuthEventService
  ) {}

  /** Always succeeds from the caller's view. Unverified, blocked and super admin accounts silently get nothing. */
  async forgotPassword(input: IEmailOnlyInput): Promise<void> {
    const startedAt = Date.now()
    const email = normalizeEmail(input.email)
    const user = await this.users.findByEmail(email)
    if (user && this.canResetPassword(user)) {
      await this.uow.execute(async () => {
        const now = new Date()
        const code = await this.otp.issue(user.id!, OtpPurpose.PASSWORD_RESET, now)
        if (code) {
          await this.outbox.insertOne(OutboxMessage.passwordResetOtp({ email, code, expiresInMinutes: this.settings.otpTtlMinutes }, now))
        }
      })
    }
    await holdMinimumDuration(startedAt, this.settings.minResponseMs)
  }

  /** Redeems the emailed code, sets the new password and signs the account out everywhere. */
  async resetPassword(input: IResetPasswordInput, device: DeviceContext): Promise<void> {
    this.assertStrong(input.newPassword)
    const now = new Date()
    const user = await this.users.findByEmail(normalizeEmail(input.email))
    if (!user || !this.canResetPassword(user)) {
      return this.otp.rejectUnknown(input.code, OtpPurpose.PASSWORD_RESET)
    }

    const otp = await this.otp.check(user.id!, OtpPurpose.PASSWORD_RESET, input.code, now)
    const passwordHash = await this.hasher.hash(input.newPassword)
    await this.uow.execute(async () => {
      if (!(await this.otp.consume(otp.id!, now))) {
        throw AuthErrors.invalidOtp()
      }
      await this.users.updatePassword(user.id!, passwordHash)
      await this.sessions.revokeAllByUser(user.id!, now)
      await this.events.record({ type: AuthEventType.PASSWORD_RESET, userId: user.id, device })
      await this.outbox.insertOne(OutboxMessage.passwordResetCompletedNotice({ email: user.email! }, now))
    })
  }

  /** Logged-in change: the current password is re-verified, every OTHER session is revoked, this one survives. */
  async changePassword(currentUser: AuthUser, input: IChangePasswordInput, device: DeviceContext): Promise<void> {
    this.assertStrong(input.newPassword)
    const user = await this.users.findByIdWithPassword(currentUser.userId)
    if (!user?.password) {
      throw AuthErrors.invalidSession()
    }
    if (user.isSuperAdmin()) {
      throw AuthErrors.passwordManagedByEnv()
    }
    if (!(await this.hasher.compare(input.currentPassword, user.password))) {
      throw AuthErrors.invalidCurrentPassword()
    }
    if (input.newPassword === input.currentPassword || (await this.hasher.compare(input.newPassword, user.password))) {
      throw AuthErrors.passwordReused()
    }

    const passwordHash = await this.hasher.hash(input.newPassword)
    await this.uow.execute(async () => {
      const now = new Date()
      await this.users.updatePassword(user.id!, passwordHash)
      await this.sessions.revokeOthersByUser(user.id!, currentUser.sessionId, now)
      await this.events.record({ type: AuthEventType.PASSWORD_CHANGED, userId: user.id, device })
      await this.outbox.insertOne(OutboxMessage.passwordChangedNotice({ email: user.email! }, now))
    })
  }

  private canResetPassword(user: User): boolean {
    return !user.isSuperAdmin() && !!user.status && RESETTABLE_STATUSES.includes(user.status)
  }

  private assertStrong(password: string): void {
    const violations = passwordPolicyViolations(password)
    if (violations.length > 0) {
      throw AuthErrors.weakPassword(violations)
    }
  }
}
