import { OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { OUTBOX_DELIVERY_CONFIG } from '@domain/outbox/constant/outbox-delivery.constant'
import { OUTBOX_EVENT_HANDLERS, type IOutboxEventHandler } from '@domain/outbox/contract/outbox-event-handler.contract'
import { DOMAIN_EVENT_TYPES, OutboxEventType } from '@domain/outbox/enum/outbox.enum'
import { OUTBOX_REPOSITORY_TOKEN, type IOutboxRepository } from '@domain/outbox/repository/outbox.repository'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'

// One source of truth, shared with the console's configuration view.
const BATCH_SIZE = OUTBOX_DELIVERY_CONFIG.batchSize
const DISPATCH_CONCURRENCY = OUTBOX_DELIVERY_CONFIG.dispatchConcurrency
const MAX_ATTEMPTS = OUTBOX_DELIVERY_CONFIG.maxAttempts
const STALE_PROCESSING_MS = OUTBOX_DELIVERY_CONFIG.staleProcessingMinutes * 60 * 1000
const PUBLISHED_RETENTION_DAYS = OUTBOX_DELIVERY_CONFIG.publishedRetentionDays

// Business events are published with zero handlers by design until a consumer is registered
// in OUTBOX_EVENT_HANDLERS (see DOMAIN_EVENT_TYPES).
const PERSIST_ONLY_EVENT_TYPES: readonly OutboxEventType[] = DOMAIN_EVENT_TYPES

/**
 * Delivery half of the transactional outbox: use-cases insert rows atomically
 * with their business writes; this poller claims due rows (SKIP LOCKED — safe
 * with multiple instances) and fans each out to the registered event handlers
 * with exponential-backoff retries. `handledBy` records per-handler success, so
 * a retry never re-runs a consumer that already delivered.
 */
@Injectable()
export class OutboxDispatcherCronJob {
  private readonly logger = new Logger(OutboxDispatcherCronJob.name)
  private readonly handlersByEventType = new Map<OutboxEventType, IOutboxEventHandler[]>()
  private dispatching = false

  constructor(
    @Inject(OUTBOX_REPOSITORY_TOKEN)
    private readonly outboxRepository: IOutboxRepository,
    @Inject(OUTBOX_EVENT_HANDLERS)
    handlers: IOutboxEventHandler[]
  ) {
    for (const handler of handlers) {
      for (const eventType of handler.supportedEventTypes()) {
        const registered = this.handlersByEventType.get(eventType) ?? []
        registered.push(handler)
        this.handlersByEventType.set(eventType, registered)
      }
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async dispatchPending(): Promise<void> {
    if (this.dispatching) return // a slow SMTP round must not stack overlapping ticks
    this.dispatching = true
    try {
      const now = new Date()
      const batch = await this.outboxRepository.claimBatch(BATCH_SIZE, now, new Date(now.getTime() - STALE_PROCESSING_MS))
      if (batch.length === 0) return
      // Bounded worker pool over the claimed batch; dispatch() never throws, so no worker dies early.
      const queue = [...batch]
      await Promise.all(
        Array.from({ length: Math.min(DISPATCH_CONCURRENCY, queue.length) }, async () => {
          for (let message = queue.shift(); message !== undefined; message = queue.shift()) {
            await this.dispatch(message)
          }
        })
      )
    } catch (error) {
      this.logger.error('Outbox dispatch tick failed', error instanceof Error ? error.stack : String(error))
    } finally {
      this.dispatching = false
    }
  }

  /** Published rows are kept a week for observability, then purged nightly. */
  @Cron('20 4 * * *')
  async purgePublished(): Promise<void> {
    const cutoff = new Date(Date.now() - PUBLISHED_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const removed = await this.outboxRepository.deletePublishedBefore(cutoff)
    this.logger.log(`Outbox cleanup: removed ${removed} published message(s) older than ${PUBLISHED_RETENTION_DAYS} days`)
  }

  private async dispatch(message: OutboxMessage): Promise<void> {
    try {
      await this.publish(message)
      await this.outboxRepository.markPublished(message.id!, new Date(), message.redactedPayload())
      this.logger.log(`Outbox message ${message.id} (${message.eventType}) published`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      if (message.hasExhaustedRetries(MAX_ATTEMPTS)) {
        await this.outboxRepository.markFailed(message.id!, reason)
        this.logger.error(`Outbox message ${message.id} (${message.eventType}) FAILED permanently after ${message.attemptsMade()} attempts: ${reason}`)
        return
      }
      const nextAttemptAt = message.nextRetryAt(new Date())
      await this.outboxRepository.scheduleRetry(message.id!, reason, nextAttemptAt)
      this.logger.warn(
        `Outbox message ${message.id} (${message.eventType}) attempt ${message.attemptsMade()} failed, retrying at ${nextAttemptAt.toISOString()}: ${reason}`
      )
    }
  }

  private async publish(message: OutboxMessage): Promise<void> {
    const handlers = this.handlersByEventType.get(message.eventType!)
    if (!handlers) {
      if (PERSIST_ONLY_EVENT_TYPES.includes(message.eventType!)) return
      throw new Error(`No handler for outbox event type: ${message.eventType}`)
    }
    for (const handler of handlers) {
      if (message.hasBeenHandledBy(handler.key)) continue // succeeded on a previous attempt
      await handler.handle(message)
      await this.outboxRepository.appendHandledBy(message.id!, handler.key)
      message.recordHandledBy(handler.key)
    }
  }
}
