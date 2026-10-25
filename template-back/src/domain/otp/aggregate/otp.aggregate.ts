import { OtpPurpose } from '@domain/otp/enum/otp.enum'

export class Otp {
  constructor(
    public id?: string,
    public userId?: string,
    public purpose?: OtpPurpose,
    public codeHash?: string,
    public expiresAt?: Date,
    public attempts?: number,
    public usedAt?: Date | null,
    public createdAt?: Date
  ) {}

  static create(props: { userId: string; purpose: OtpPurpose; codeHash: string; expiresAt: Date }): Otp {
    return new Otp(undefined, props.userId, props.purpose, props.codeHash, props.expiresAt, 0, null)
  }

  static restore(id: string, userId: string, purpose: OtpPurpose, codeHash: string, expiresAt: Date, attempts: number, usedAt: Date | null, createdAt: Date): Otp {
    return new Otp(id, userId, purpose, codeHash, expiresAt, attempts, usedAt, createdAt)
  }

  isExpired(now: Date): boolean {
    return !!this.expiresAt && now.getTime() >= this.expiresAt.getTime()
  }

  isUsed(): boolean {
    return !!this.usedAt
  }
}
