import { Session } from '@domain/session/aggregate/session.aggregate'
import { ISessionRepository } from '@domain/session/repository/session.repository'
import { SessionMapper } from '@infrastructure/database/session/mapper/session.mapper'
import { SessionOrmEntity } from '@infrastructure/database/session/orm-entity/session.orm.entity'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, LessThan, MoreThan, Not, Repository } from 'typeorm'

@Injectable()
export class SessionRepositoryImpl implements ISessionRepository {
  constructor(
    @InjectRepository(SessionOrmEntity)
    private readonly sessionRepo: Repository<SessionOrmEntity>
  ) {}

  async insertOne(entity: Session): Promise<Session> {
    const saved = await this.sessionRepo.save(SessionMapper.toOrm(entity))
    return SessionMapper.toDomain(saved)
  }

  async findById(id: string): Promise<Session | null> {
    const row = await this.sessionRepo.findOne({ where: { id } })
    return row ? SessionMapper.toDomain(row) : null
  }

  async findOpenByUser(userId: string, now: Date): Promise<Session[]> {
    const rows = await this.sessionRepo.find({ where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(now) }, order: { createdAt: 'ASC' } })
    return rows.map((row) => SessionMapper.toDomain(row))
  }

  async rotate(id: string, currentHash: string, nextHash: string, expiresAt: Date, now: Date): Promise<boolean> {
    const result = await this.sessionRepo.update(
      { id, refreshTokenHash: currentHash, revokedAt: IsNull() },
      { refreshTokenHash: nextHash, rotatedFrom: currentHash, rotatedAt: now, expiresAt, lastActiveAt: now }
    )
    return (result.affected ?? 0) > 0
  }

  async touchLastActive(id: string, at: Date): Promise<void> {
    await this.sessionRepo.update({ id }, { lastActiveAt: at })
  }

  async revokeByIdAndUser(id: string, userId: string, at: Date): Promise<boolean> {
    const result = await this.sessionRepo.update({ id, userId, revokedAt: IsNull() }, { revokedAt: at })
    return (result.affected ?? 0) > 0
  }

  async revokeById(id: string, at: Date): Promise<void> {
    await this.sessionRepo.update({ id, revokedAt: IsNull() }, { revokedAt: at })
  }

  async revokeManyByIds(ids: string[], at: Date): Promise<void> {
    if (ids.length === 0) return
    await this.sessionRepo.update({ id: In(ids), revokedAt: IsNull() }, { revokedAt: at })
  }

  async revokeAllByUser(userId: string, at: Date): Promise<number> {
    const result = await this.sessionRepo.update({ userId, revokedAt: IsNull() }, { revokedAt: at })
    return result.affected ?? 0
  }

  async revokeOthersByUser(userId: string, exceptSessionId: string, at: Date): Promise<number> {
    const result = await this.sessionRepo.update({ userId, id: Not(exceptSessionId), revokedAt: IsNull() }, { revokedAt: at })
    return result.affected ?? 0
  }

  async deleteStale(now: Date, revokedBefore: Date): Promise<number> {
    const expired = await this.sessionRepo.delete({ expiresAt: LessThan(now) })
    const revoked = await this.sessionRepo.delete({ revokedAt: LessThan(revokedBefore) })
    return (expired.affected ?? 0) + (revoked.affected ?? 0)
  }
}
