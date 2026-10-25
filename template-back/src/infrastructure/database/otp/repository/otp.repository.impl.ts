import { Otp } from '@domain/otp/aggregate/otp.aggregate'
import { OtpPurpose } from '@domain/otp/enum/otp.enum'
import { IOtpRepository } from '@domain/otp/repository/otp.repository'
import { OtpMapper } from '@infrastructure/database/otp/mapper/otp.mapper'
import { OtpOrmEntity } from '@infrastructure/database/otp/orm-entity/otp.orm.entity'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, LessThan, MoreThanOrEqual, Repository } from 'typeorm'

@Injectable()
export class OtpRepositoryImpl implements IOtpRepository {
  constructor(
    @InjectRepository(OtpOrmEntity)
    private readonly otpRepo: Repository<OtpOrmEntity>
  ) {}

  async insertOne(entity: Otp): Promise<Otp> {
    const saved = await this.otpRepo.save(OtpMapper.toOrm(entity))
    return OtpMapper.toDomain(saved)
  }

  async findLatestUnused(userId: string, purpose: OtpPurpose): Promise<Otp | null> {
    const row = await this.otpRepo.findOne({
      where: { userId, purpose: OtpMapper.mapPurposeToOrm(purpose), usedAt: IsNull() },
      order: { createdAt: 'DESC', id: 'DESC' },
    })
    return row ? OtpMapper.toDomain(row) : null
  }

  async findLatest(userId: string, purpose: OtpPurpose): Promise<Otp | null> {
    const row = await this.otpRepo.findOne({ where: { userId, purpose: OtpMapper.mapPurposeToOrm(purpose) }, order: { createdAt: 'DESC', id: 'DESC' } })
    return row ? OtpMapper.toDomain(row) : null
  }

  countCreatedSince(userId: string, purpose: OtpPurpose, since: Date): Promise<number> {
    return this.otpRepo.count({ where: { userId, purpose: OtpMapper.mapPurposeToOrm(purpose), createdAt: MoreThanOrEqual(since) } })
  }

  async invalidateUnused(userId: string, purpose: OtpPurpose, at: Date): Promise<void> {
    await this.otpRepo.update({ userId, purpose: OtpMapper.mapPurposeToOrm(purpose), usedAt: IsNull() }, { usedAt: at })
  }

  async incrementAttempts(id: string): Promise<number> {
    const result = await this.otpRepo
      .createQueryBuilder()
      .update(OtpOrmEntity)
      .set({ attempts: () => '"attempts" + 1' })
      .where('id = :id', { id })
      .returning('"attempts"')
      .execute()
    return (result.raw as Array<{ attempts: number }>)[0]?.attempts ?? Number.MAX_SAFE_INTEGER
  }

  async consumeIfUnused(id: string, at: Date): Promise<boolean> {
    const result = await this.otpRepo.update({ id, usedAt: IsNull() }, { usedAt: at })
    return (result.affected ?? 0) > 0
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.otpRepo.delete({ expiresAt: LessThan(now) })
    return result.affected ?? 0
  }
}
