import { IEmailSender } from '@domain/auth/contract/email-sender.contract'
import {
  EmailContent,
  emailVerificationOtpTemplate,
  passwordChangedNoticeTemplate,
  passwordResetCompletedNoticeTemplate,
  passwordResetOtpTemplate,
} from '@infrastructure/email/template/auth-email.templates'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport, Transporter } from 'nodemailer'

/**
 * Production adapter for EMAIL_SENDER_TOKEN (nodemailer over SMTP, pooled
 * connections, optional STARTTLS enforcement). Errors propagate to the
 * caller — delivery retries are the outbox dispatcher's job, not something
 * to swallow here.
 */
@Injectable()
export class SmtpEmailSender implements IEmailSender, OnModuleInit {
  private readonly logger = new Logger(SmtpEmailSender.name)
  private readonly transporter: Transporter
  private readonly from: string
  private readonly replyTo?: string

  constructor(configService: ConfigService) {
    const config = configService.get<{
      host: string
      port: number
      secure: boolean
      requireTls: boolean
      user?: string
      pass?: string
      from: string
      replyTo?: string
    }>('EmailConfig')!

    this.from = config.from
    this.replyTo = config.replyTo
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTls,
      pool: true,
      maxConnections: 5,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    })
  }

  /**
   * Probe the SMTP connection/credentials at boot so misconfiguration shows
   * up immediately. Deliberately non-fatal: a transient SMTP outage must not
   * block deployment — queued mail is retried by the outbox dispatcher.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.transporter.verify()
      this.logger.log('SMTP connection verified')
    } catch (error) {
      this.logger.error(`SMTP verification failed — outgoing mail will be retried by the outbox: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async sendEmailVerificationOtp(input: { email: string; code: string; expiresInMinutes: number }): Promise<void> {
    await this.send(input.email, emailVerificationOtpTemplate(input))
  }

  async sendPasswordResetOtp(input: { email: string; code: string; expiresInMinutes: number }): Promise<void> {
    await this.send(input.email, passwordResetOtpTemplate(input))
  }

  async sendPasswordChangedNotice(input: { email: string }): Promise<void> {
    await this.send(input.email, passwordChangedNoticeTemplate())
  }

  async sendPasswordResetCompletedNotice(input: { email: string }): Promise<void> {
    await this.send(input.email, passwordResetCompletedNoticeTemplate())
  }

  private async send(to: string, content: EmailContent): Promise<void> {
    const info = (await this.transporter.sendMail({
      from: this.from,
      replyTo: this.replyTo,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    })) as { messageId?: string }
    this.logger.log(`Email sent subject="${content.subject}" messageId=${info.messageId ?? 'n/a'}`)
  }
}
