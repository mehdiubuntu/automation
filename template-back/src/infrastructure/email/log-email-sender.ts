import { IEmailSender } from '@domain/auth/contract/email-sender.contract'
import { Injectable, Logger } from '@nestjs/common'

/**
 * Development adapter, used when EMAIL_ENABLED is not 'true' (production refuses to boot with it):
 * the message is written to the application log instead of being sent. It prints OTP codes
 * on purpose - without them nobody could finish a signup locally. SMTP never logs a code.
 */
@Injectable()
export class LogEmailSender implements IEmailSender {
  private readonly logger = new Logger(LogEmailSender.name)

  sendEmailVerificationOtp(input: { email: string; code: string; expiresInMinutes: number }): Promise<void> {
    this.logger.log(`[dev email] verification code for ${input.email}: ${input.code} (valid ${input.expiresInMinutes} min)`)
    return Promise.resolve()
  }

  sendPasswordResetOtp(input: { email: string; code: string; expiresInMinutes: number }): Promise<void> {
    this.logger.log(`[dev email] password reset code for ${input.email}: ${input.code} (valid ${input.expiresInMinutes} min)`)
    return Promise.resolve()
  }

  sendPasswordChangedNotice(input: { email: string }): Promise<void> {
    this.logger.log(`[dev email] password changed notice for ${input.email}`)
    return Promise.resolve()
  }

  sendPasswordResetCompletedNotice(input: { email: string }): Promise<void> {
    this.logger.log(`[dev email] password reset completed notice for ${input.email}`)
    return Promise.resolve()
  }
}
