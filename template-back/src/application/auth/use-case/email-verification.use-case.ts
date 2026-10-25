import { AuthErrors } from '@application/auth/error/auth.errors'
import { IEmailOnlyInput, IVerifyEmailInput } from '@application/auth/interface/auth.input.interface'
import { IVerifyEmailResult } from '@application/auth/interface/auth-result.interface'
import { AuthEventService } from '@application/auth/service/auth-event.service'
import { OtpService } from '@application/auth/service/otp.service'
import { holdMinimumDuration } from '@application/shared/util/response-time.util'
import { AUTH_SETTINGS_TOKEN, type IAuthSettings } from '@domain/auth/contract/auth-settings.contract'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { OtpPurpose } from '@domain/otp/enum/otp.enum'
import { OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { OUTBOX_REPOSITORY_TOKEN, type IOutboxRepository } from '@domain/outbox/repository/outbox.repository'
import { DeviceContext } from '@domain/session/service/device-info'
import { UNIT_OF_WORK_TOKEN, type UnitOfWork } from '@domain/shared/unit-of-work/unit-of-work.interface'
import { UserStatus } from '@domain/user/enum/user.enum'
import { USER_REPOSITORY_TOKEN, type IUserRepository } from '@domain/user/repository/user.repository'
import { normalizeEmail } from '@domain/user/util/email.util'
import { Inject, Injectable } from '@nestjs/common'

@Injectable()
export class EmailVerificationUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private readonly users: IUserRepository,
    @Inject(OUTBOX_REPOSITORY_TOKEN) private readonly outbox: IOutboxRepository,
    @Inject(UNIT_OF_WORK_TOKEN) private readonly uow: UnitOfWork,
    @Inject(AUTH_SETTINGS_TOKEN) private readonly settings: IAuthSettings,
    private readonly otp: OtpService,
    private readonly events: AuthEventService
  ) {}

  /** Proves the email: PENDING_VERIFICATION becomes PENDING_APPROVAL (or ACTIVE when REQUIRE_APPROVAL=false). */
  async verifyEmail(input: IVerifyEmailInput, device: DeviceContext): Promise<IVerifyEmailResult> {
    const now = new Date()
    const user = await this.users.findByEmail(normalizeEmail(input.email))
    if (!user || user.status !== UserStatus.PENDING_VERIFICATION) {
      return this.otp.rejectUnknown(input.code, OtpPurpose.EMAIL_VERIFICATION)
    }

    const otp = await this.otp.check(user.id!, OtpPurpose.EMAIL_VERIFICATION, input.code, now)
    const status = user.statusAfterEmailVerification(this.settings.requireApproval)
    await this.uow.execute(async () => {
      if (!(await this.otp.consume(otp.id!, now))) {
        throw AuthErrors.invalidOtp()
      }
      await this.users.markEmailVerified(user.id!, status, now)
      await this.events.record({ type: AuthEventType.EMAIL_VERIFIED, userId: user.id, device })
    })
    return { status }
  }

  /** Always succeeds from the caller's view; a code is only sent to an unverified account, subject to cooldown and hourly cap. */
  async resendVerification(input: IEmailOnlyInput): Promise<void> {
    const startedAt = Date.now()
    const email = normalizeEmail(input.email)
    const user = await this.users.findByEmail(email)
    if (user?.status === UserStatus.PENDING_VERIFICATION) {
      await this.uow.execute(async () => {
        const now = new Date()
        const code = await this.otp.issue(user.id!, OtpPurpose.EMAIL_VERIFICATION, now)
        if (code) {
          await this.outbox.insertOne(OutboxMessage.emailVerificationOtp({ email, code, expiresInMinutes: this.settings.otpTtlMinutes }, now))
        }
      })
    }
    await holdMinimumDuration(startedAt, this.settings.minResponseMs)
  }
}
