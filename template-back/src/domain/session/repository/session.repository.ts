import { Session } from '@domain/session/aggregate/session.aggregate'

export const SESSION_REPOSITORY_TOKEN = Symbol('SESSION_REPOSITORY_TOKEN')

export interface ISessionRepository {
  insertOne(entity: Session): Promise<Session>
  findById(id: string): Promise<Session | null>
  /** Not revoked and not past expiresAt, oldest first. Idle/absolute limits are applied by the caller. */
  findOpenByUser(userId: string, now: Date): Promise<Session[]>
  /** Compare-and-swap rotation: succeeds only while the row still holds `currentHash`. */
  rotate(id: string, currentHash: string, nextHash: string, expiresAt: Date, now: Date): Promise<boolean>
  touchLastActive(id: string, at: Date): Promise<void>
  /** Returns whether a live row was revoked. */
  revokeByIdAndUser(id: string, userId: string, at: Date): Promise<boolean>
  revokeById(id: string, at: Date): Promise<void>
  revokeManyByIds(ids: string[], at: Date): Promise<void>
  /** Returns how many sessions were revoked. */
  revokeAllByUser(userId: string, at: Date): Promise<number>
  revokeOthersByUser(userId: string, exceptSessionId: string, at: Date): Promise<number>
  /** Expired sessions, plus revoked ones older than `revokedBefore`. */
  deleteStale(now: Date, revokedBefore: Date): Promise<number>
}
