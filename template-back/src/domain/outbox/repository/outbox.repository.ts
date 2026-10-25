import { OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { OutboxEventType, OutboxStatus } from '@domain/outbox/enum/outbox.enum'
import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'

export const OUTBOX_REPOSITORY_TOKEN = Symbol('OUTBOX_REPOSITORY_TOKEN')

/**
 * Queue health. Must stay cheap to produce — the console refreshes often and the
 * published-message record grows without bound, so no figure here may scan the
 * whole set (R8/R9).
 */
export interface OutboxHealthCounts {
  pending: number
  processing: number
  published: number
  failed: number
  cancelled: number
  /**
   * PENDING rows that have already failed at least once. The single most
   * important health indicator: 400 pending is normal, 400 retrying is an incident.
   */
  retrying: number
  /** Work ready for delivery right now — the true backlog. */
  dueNow: number
  publishedLast24h: number
  queuedLast24h: number
}

/** Non-delivered counts per event type, so a channel-wide fault is distinguishable from a general one. */
export interface OutboxProblemBreakdown {
  eventType: string
  pending: number
  failed: number
  cancelled: number
}

export interface IOutboxRepository {
  insertOne(entity: OutboxMessage): Promise<OutboxMessage>
  findById(id: string): Promise<OutboxMessage | null>
  findMessages(query: {
    limit?: number
    page?: number
    order?: OrderDirectionEnum
    status?: OutboxStatus
    eventType?: OutboxEventType
    aggregateId?: string
    /** Console-only refinement: PENDING rows that have already been attempted (§33.2). */
    retryingOnly?: boolean
    search?: string
  }): Promise<IPaginatedResponse<OutboxMessage>>
  /** Every health figure in ONE aggregate query. */
  countHealth(now: Date, since24h: Date): Promise<OutboxHealthCounts>
  /** Problem states per event type — deliberately excludes PUBLISHED (§38.3). */
  countProblemsByEventType(): Promise<OutboxProblemBreakdown[]>
  /**
   * Administrative transitions, each conditional on the row still being in one of
   * `expectedStatuses` (T5): a message the dispatcher claimed in the same moment is
   * simply not affected, and the caller learns that from the `false` return.
   */
  transitionWhileInStatus(
    id: string,
    expectedStatuses: OutboxStatus[],
    patch: { status: OutboxStatus; retryCount?: number; nextAttemptAt?: Date; lastError?: string | null }
  ): Promise<boolean>
  /** Bulk retry: returns the ids actually returned to the queue; ineligible rows are skipped, not failed. */
  retryManyWhileInStatus(ids: string[], expectedStatuses: OutboxStatus[], nextAttemptAt: Date): Promise<string[]>
  /**
   * Atomically claims a batch for dispatch (flips it to PROCESSING) and returns it.
   * Eligible: PENDING rows whose nextAttemptAt is due, plus PROCESSING rows untouched
   * since `staleBefore` (a previous dispatcher died mid-flight). Safe under multiple
   * app instances — claimed rows are invisible to concurrent pollers.
   */
  claimBatch(limit: number, now: Date, staleBefore: Date): Promise<OutboxMessage[]>
  /** Records a consumer's success immediately, so a later retry re-runs only the handlers that failed. */
  appendHandledBy(id: string, handlerKey: string): Promise<void>
  markPublished(id: string, at: Date, redactedPayload: unknown): Promise<void>
  scheduleRetry(id: string, error: string, nextAttemptAt: Date): Promise<void>
  markFailed(id: string, error: string): Promise<void>
  deletePublishedBefore(cutoff: Date): Promise<number>
}
