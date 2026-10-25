import { AUTH_EVENT_REPOSITORY_TOKEN, type IAuthEventRepository } from '@domain/auth-event/repository/auth-event.repository'
import { OTP_REPOSITORY_TOKEN, type IOtpRepository } from '@domain/otp/repository/otp.repository'
import { SESSION_REPOSITORY_TOKEN, type ISessionRepository } from '@domain/session/repository/session.repository'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'

const DAY_MS = 24 * 60 * 60 * 1000
/** Revoked sessions are kept this long so a replayed refresh token still resolves to a known (dead) session. */
const REVOKED_SESSION_RETENTION_DAYS = 7

/** Nightly purge of expired OTPs and sessions and aged-out auth events (Postgres has no TTL indexes). */
@Injectable()
export class AuthCleanupCronJob {
  private readonly logger = new Logger(AuthCleanupCronJob.name)
  private readonly authEventRetentionDays: number

  constructor(
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepository: ISessionRepository,
    @Inject(OTP_REPOSITORY_TOKEN)
    private readonly otpRepository: IOtpRepository,
    @Inject(AUTH_EVENT_REPOSITORY_TOKEN)
    private readonly authEventRepository: IAuthEventRepository,
    configService: ConfigService
  ) {
    this.authEventRetentionDays = configService.get<number>('AuthConfig.authEventRetentionDays') ?? 90
  }

  @Cron('15 4 * * *')
  async handleCron(): Promise<void> {
    const now = new Date()
    const sessions = await this.sessionRepository.deleteStale(now, new Date(now.getTime() - REVOKED_SESSION_RETENTION_DAYS * DAY_MS))
    const otps = await this.otpRepository.deleteExpired(now)
    const events = await this.authEventRepository.deleteOlderThan(new Date(now.getTime() - this.authEventRetentionDays * DAY_MS))
    this.logger.log(`Auth cleanup: removed ${sessions} stale session(s), ${otps} expired OTP(s), ${events} aged auth event(s)`)
  }
}
