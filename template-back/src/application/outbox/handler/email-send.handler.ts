import { EMAIL_SENDER_TOKEN, type IEmailSender } from '@domain/auth/contract/email-sender.contract'
import { NoticeEmailPayload, OtpEmailPayload, OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { IOutboxEventHandler } from '@domain/outbox/contract/outbox-event-handler.contract'
import { OutboxEventType } from '@domain/outbox/enum/outbox.enum'
import { Inject, Injectable } from '@nestjs/common'

/** Delivers the direct transactional email events through the email port. */
@Injectable()
export class EmailSendHandler implements IOutboxEventHandler {
  readonly key = 'email'

  constructor(
    @Inject(EMAIL_SENDER_TOKEN)
    private readonly emailSender: IEmailSender
  ) {}

  supportedEventTypes(): OutboxEventType[] {
    return [
      OutboxEventType.SEND_EMAIL_VERIFICATION_OTP,
      OutboxEventType.SEND_PASSWORD_RESET_OTP,
      OutboxEventType.SEND_PASSWORD_CHANGED_NOTICE,
      OutboxEventType.SEND_PASSWORD_RESET_COMPLETED_NOTICE,
    ]
  }

  async handle(message: OutboxMessage): Promise<void> {
    switch (message.eventType) {
      case OutboxEventType.SEND_EMAIL_VERIFICATION_OTP:
        return this.emailSender.sendEmailVerificationOtp(message.payload as OtpEmailPayload)
      case OutboxEventType.SEND_PASSWORD_RESET_OTP:
        return this.emailSender.sendPasswordResetOtp(message.payload as OtpEmailPayload)
      case OutboxEventType.SEND_PASSWORD_CHANGED_NOTICE:
        return this.emailSender.sendPasswordChangedNotice(message.payload as NoticeEmailPayload)
      case OutboxEventType.SEND_PASSWORD_RESET_COMPLETED_NOTICE:
        return this.emailSender.sendPasswordResetCompletedNotice(message.payload as NoticeEmailPayload)
      default:
        throw new Error(`EmailSendHandler cannot handle event type: ${message.eventType}`)
    }
  }
}
