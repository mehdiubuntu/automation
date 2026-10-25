import { IOtpCodeProvider, OTP_CODE_LENGTH, OtpContext } from '@domain/otp/contract/otp-code.contract'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, randomInt, timingSafeEqual } from 'crypto'

/** HMAC-SHA256 keyed with a server secret (OTP_HMAC_SECRET): a leaked table alone cannot be brute-forced offline. */
@Injectable()
export class CryptoOtpCodeProvider implements IOtpCodeProvider {
  private readonly secret: string

  constructor(configService: ConfigService) {
    this.secret = configService.get<string>('AuthConfig.otpHmacSecret')!
  }

  generate(): string {
    return randomInt(0, 10 ** OTP_CODE_LENGTH)
      .toString()
      .padStart(OTP_CODE_LENGTH, '0')
  }

  hash(code: string, context: OtpContext): string {
    return createHmac('sha256', this.secret).update(`${context.purpose}:${context.userId}:${code}`).digest('hex')
  }

  matches(code: string, context: OtpContext, storedHash: string): boolean {
    const presented = Buffer.from(this.hash(code, context))
    const stored = Buffer.from(storedHash)
    return presented.length === stored.length && timingSafeEqual(presented, stored)
  }
}
