import { Otp } from '@domain/otp/aggregate/otp.aggregate'
import { OtpPurpose } from '@domain/otp/enum/otp.enum'

export const OTP_REPOSITORY_TOKEN = Symbol('OTP_REPOSITORY_TOKEN')

export interface IOtpRepository {
  insertOne(entity: Otp): Promise<Otp>
  /** The newest code of this purpose that has not been used (it may be expired). */
  findLatestUnused(userId: string, purpose: OtpPurpose): Promise<Otp | null>
  findLatest(userId: string, purpose: OtpPurpose): Promise<Otp | null>
  countCreatedSince(userId: string, purpose: OtpPurpose, since: Date): Promise<number>
  /** A new code kills every older unused one: marks them used. */
  invalidateUnused(userId: string, purpose: OtpPurpose, at: Date): Promise<void>
  /** Atomic: counts a guess and returns the new total. */
  incrementAttempts(id: string): Promise<number>
  /** Atomic single-use gate: true only for the one caller that flips an unused code to used. */
  consumeIfUnused(id: string, at: Date): Promise<boolean>
  deleteExpired(now: Date): Promise<number>
}
