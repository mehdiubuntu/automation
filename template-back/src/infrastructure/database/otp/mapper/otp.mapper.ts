import { Otp } from '@domain/otp/aggregate/otp.aggregate'
import { OtpPurpose } from '@domain/otp/enum/otp.enum'
import { OtpOrmEntity } from '@infrastructure/database/otp/orm-entity/otp.orm.entity'

const PURPOSE_TO_ORM: Record<OtpPurpose, number> = {
  [OtpPurpose.EMAIL_VERIFICATION]: 1,
  [OtpPurpose.PASSWORD_RESET]: 2,
}

const PURPOSE_TO_DOMAIN: Record<number, OtpPurpose> = {
  1: OtpPurpose.EMAIL_VERIFICATION,
  2: OtpPurpose.PASSWORD_RESET,
}

export class OtpMapper {
  static toDomain(entity: OtpOrmEntity): Otp {
    return Otp.restore(
      entity.id,
      entity.userId,
      PURPOSE_TO_DOMAIN[entity.purpose],
      entity.codeHash,
      entity.expiresAt,
      entity.attempts,
      entity.usedAt ?? null,
      entity.createdAt
    )
  }

  static toOrm(otp: Otp): OtpOrmEntity {
    const ormEntity = new OtpOrmEntity()

    if (otp.id !== undefined) ormEntity.id = otp.id
    if (otp.userId !== undefined) ormEntity.userId = otp.userId
    if (otp.purpose !== undefined) ormEntity.purpose = this.mapPurposeToOrm(otp.purpose)
    if (otp.codeHash !== undefined) ormEntity.codeHash = otp.codeHash
    if (otp.expiresAt !== undefined) ormEntity.expiresAt = otp.expiresAt
    if (otp.attempts !== undefined) ormEntity.attempts = otp.attempts
    if (otp.usedAt !== undefined) ormEntity.usedAt = otp.usedAt

    return ormEntity
  }

  static mapPurposeToOrm(purpose: OtpPurpose): number {
    return PURPOSE_TO_ORM[purpose]
  }
}
