import { IRegisterInput } from '@application/auth/interface/auth.input.interface'
import { AuthEventService } from '@application/auth/service/auth-event.service'
import { OtpService } from '@application/auth/service/otp.service'
import { holdMinimumDuration } from '@application/shared/util/response-time.util'
import { AUTH_SETTINGS_TOKEN, type IAuthSettings } from '@domain/auth/contract/auth-settings.contract'
import { PASSWORD_HASHER_TOKEN, type IPasswordHasher } from '@domain/auth/contract/password-hasher.contract'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { OtpPurpose } from '@domain/otp/enum/otp.enum'
import { OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { OUTBOX_REPOSITORY_TOKEN, type IOutboxRepository } from '@domain/outbox/repository/outbox.repository'
import { DeviceContext } from '@domain/session/service/device-info'
import { UNIT_OF_WORK_TOKEN, type UnitOfWork } from '@domain/shared/unit-of-work/unit-of-work.interface'
import { User } from '@domain/user/aggregate/user.aggregate'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'
import { USER_REPOSITORY_TOKEN, type IUserRepository } from '@domain/user/repository/user.repository'
import { normalizeEmail } from '@domain/user/util/email.util'
import { Inject, Injectable } from '@nestjs/common'

/**
 * Self-registration. Always creates a SPARTAN in PENDING_VERIFICATION and always answers the same
 * way: an already-registered email (or the super admin email) gets no error and no email, and thanks
 * to the dummy hash and the minimum duration no timing difference either.
 */
@Injectable()
export class RegistrationUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER_TOKEN) private readonly hasher: IPasswordHasher,
    @Inject(OUTBOX_REPOSITORY_TOKEN) private readonly outbox: IOutboxRepository,
    @Inject(UNIT_OF_WORK_TOKEN) private readonly uow: UnitOfWork,
    @Inject(AUTH_SETTINGS_TOKEN) private readonly settings: IAuthSettings,
    private readonly otp: OtpService,
    private readonly events: AuthEventService
  ) {}

  async register(input: IRegisterInput, device: DeviceContext): Promise<void> {
    const startedAt = Date.now()
    await this.process(normalizeEmail(input.email), input.password, device)
    await holdMinimumDuration(startedAt, this.settings.minResponseMs)
  }

  private async process(email: string, password: string, device: DeviceContext): Promise<void> {
    if (email === this.settings.superAdminEmail || (await this.users.findByEmail(email))) {
      await this.hasher.hash(password)
      return
    }

    const passwordHash = await this.hasher.hash(password)
    try {
      await this.uow.execute(async () => {
        const now = new Date()
        const user = await this.users.insertOne(User.create({ email, password: passwordHash, role: UserRole.SPARTAN, status: UserStatus.PENDING_VERIFICATION }))
        const code = await this.otp.issue(user.id!, OtpPurpose.EMAIL_VERIFICATION, now)
        if (code) {
          await this.outbox.insertOne(OutboxMessage.emailVerificationOtp({ email, code, expiresInMinutes: this.settings.otpTtlMinutes }, now))
        }
        await this.events.record({ type: AuthEventType.REGISTERED, userId: user.id, device })
      })
    } catch (error) {
      // A parallel registration of the same email won the unique index: answer like any duplicate.
      if (await this.users.findByEmail(email)) return
      throw error
    }
  }
}
