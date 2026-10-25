import { OtpPurpose } from '@domain/otp/enum/otp.enum'

export const OTP_CODE_PROVIDER_TOKEN = Symbol('OTP_CODE_PROVIDER_TOKEN')

export const OTP_CODE_LENGTH = 6

export interface OtpContext {
  userId: string
  purpose: OtpPurpose
}

export interface IOtpCodeProvider {
  /** Cryptographically random numeric code of OTP_CODE_LENGTH digits (leading zeros kept). */
  generate(): string
  /** Keyed hash bound to the user and purpose - a code for one purpose can never satisfy another. */
  hash(code: string, context: OtpContext): string
  /** Constant-time comparison of a presented code against a stored hash. */
  matches(code: string, context: OtpContext, storedHash: string): boolean
}
