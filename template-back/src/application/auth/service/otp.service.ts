import { AuthErrors } from '@application/auth/error/auth.errors'
import { AUTH_SETTINGS_TOKEN, type IAuthSettings } from '@domain/auth/contract/auth-settings.contract'
import { Otp } from '@domain/otp/aggregate/otp.aggregate'
import { OTP_CODE_PROVIDER_TOKEN, type IOtpCodeProvider } from '@domain/otp/contract/otp-code.contract'
import { OtpPurpose } from '@domain/otp/enum/otp.enum'
import { OTP_REPOSITORY_TOKEN, type IOtpRepository } from '@domain/otp/repository/otp.repository'
import { Inject, Injectable } from '@nestjs/common'

const HOUR_MS = 60 * 60 * 1000
const DUMMY_USER_ID = '00000000-0000-0000-0000-000000000000'

/**
 * One-time codes for email verification and password reset. Codes are 6 random digits, stored only as a
 * keyed hash, valid for OTP_TTL_MINUTES, dead after OTP_MAX_ATTEMPTS wrong guesses, single use, and a new
 * code invalidates the older ones. Every verification failure is the same AUTH_INVALID_OTP so the response
 * never reveals whether an account exists or why a code failed.
 */
@Injectable()
export class OtpService {
  constructor(
    @Inject(OTP_REPOSITORY_TOKEN)
    private readonly otps: IOtpRepository,
    @Inject(OTP_CODE_PROVIDER_TOKEN)
    private readonly codes: IOtpCodeProvider,
    @Inject(AUTH_SETTINGS_TOKEN)
    private readonly settings: IAuthSettings
  ) {}

  /**
   * Creates a new code and kills the older ones. Returns the plain code (it only travels to the email),
   * or null when the resend cooldown or the hourly cap says "not now" - callers answer the same either way.
   */
  async issue(userId: string, purpose: OtpPurpose, now: Date): Promise<string | null> {
    const latest = await this.otps.findLatest(userId, purpose)
    if (latest?.createdAt && now.getTime() - latest.createdAt.getTime() < this.settings.otpResendCooldownSeconds * 1000) return null
    if ((await this.otps.countCreatedSince(userId, purpose, new Date(now.getTime() - HOUR_MS))) >= this.settings.otpHourlyCap) return null

    await this.otps.invalidateUnused(userId, purpose, now)
    const code = this.codes.generate()
    await this.otps.insertOne(
      Otp.create({
        userId,
        purpose,
        codeHash: this.codes.hash(code, { userId, purpose }),
        expiresAt: new Date(now.getTime() + this.settings.otpTtlMinutes * 60 * 1000),
      })
    )
    return code
  }

  /**
   * Counts the guess (atomically, outside any transaction so a failure still counts) and checks it.
   * Returns the live code row on success; the caller consumes it inside its own unit of work.
   */
  async check(userId: string, purpose: OtpPurpose, code: string, now: Date): Promise<Otp> {
    const otp = await this.otps.findLatestUnused(userId, purpose)
    if (!otp || otp.isExpired(now)) {
      this.spendTime(code, purpose)
      throw AuthErrors.invalidOtp()
    }
    const attempts = await this.otps.incrementAttempts(otp.id!)
    if (attempts > this.settings.otpMaxAttempts || !this.codes.matches(code, { userId, purpose }, otp.codeHash!)) {
      throw AuthErrors.invalidOtp()
    }
    return otp
  }

  /** Same work and the same error as a failed check, for an email that has nothing to verify. */
  rejectUnknown(code: string, purpose: OtpPurpose): never {
    this.spendTime(code, purpose)
    throw AuthErrors.invalidOtp()
  }

  /** The single-use gate: true only for the caller that flips the code to used. */
  consume(otpId: string, now: Date): Promise<boolean> {
    return this.otps.consumeIfUnused(otpId, now)
  }

  private spendTime(code: string, purpose: OtpPurpose): void {
    this.codes.matches(code, { userId: DUMMY_USER_ID, purpose }, this.codes.hash('000000', { userId: DUMMY_USER_ID, purpose }))
  }
}
