import { OutboxAggregateType, OutboxEventType, OutboxStatus } from '@domain/outbox/enum/outbox.enum'

export interface OtpEmailPayload {
  email: string
  /** Plain code: the email needs it. The row is scrubbed (redactedPayload) once delivered and never leaves through monitoring. */
  code: string
  expiresInMinutes: number
}

export interface NoticeEmailPayload {
  email: string
}

const RETRY_BASE_DELAY_MS = 30 * 1000

export class OutboxMessage {
  constructor(
    public id?: string,
    public aggregateType?: OutboxAggregateType,
    public aggregateId?: string,
    public eventType?: OutboxEventType,
    public payload?: unknown,
    public status?: OutboxStatus,
    public retryCount?: number,
    public lastError?: string,
    public nextAttemptAt?: Date,
    public publishedAt?: Date,
    public createdAt?: Date,
    public handledBy?: string[]
  ) {}

  static create(props: { aggregateType: OutboxAggregateType; aggregateId: string; eventType: OutboxEventType; payload: unknown; now: Date }): OutboxMessage {
    return new OutboxMessage(undefined, props.aggregateType, props.aggregateId, props.eventType, props.payload, OutboxStatus.PENDING, 0, undefined, props.now)
  }

  static restore(
    id?: string,
    aggregateType?: OutboxAggregateType,
    aggregateId?: string,
    eventType?: OutboxEventType,
    payload?: unknown,
    status?: OutboxStatus,
    retryCount?: number,
    lastError?: string,
    nextAttemptAt?: Date,
    publishedAt?: Date,
    createdAt?: Date,
    handledBy?: string[]
  ): OutboxMessage {
    return new OutboxMessage(id, aggregateType, aggregateId, eventType, payload, status, retryCount, lastError, nextAttemptAt, publishedAt, createdAt, handledBy)
  }

  static emailVerificationOtp(payload: OtpEmailPayload, now: Date): OutboxMessage {
    return OutboxMessage.email(OutboxEventType.SEND_EMAIL_VERIFICATION_OTP, payload.email, payload, now)
  }

  static passwordResetOtp(payload: OtpEmailPayload, now: Date): OutboxMessage {
    return OutboxMessage.email(OutboxEventType.SEND_PASSWORD_RESET_OTP, payload.email, payload, now)
  }

  static passwordChangedNotice(payload: NoticeEmailPayload, now: Date): OutboxMessage {
    return OutboxMessage.email(OutboxEventType.SEND_PASSWORD_CHANGED_NOTICE, payload.email, payload, now)
  }

  static passwordResetCompletedNotice(payload: NoticeEmailPayload, now: Date): OutboxMessage {
    return OutboxMessage.email(OutboxEventType.SEND_PASSWORD_RESET_COMPLETED_NOTICE, payload.email, payload, now)
  }

  private static email(eventType: OutboxEventType, email: string, payload: unknown, now: Date): OutboxMessage {
    return OutboxMessage.create({ aggregateType: OutboxAggregateType.EMAIL, aggregateId: email, eventType, payload, now })
  }

  /** What stays in the row after a successful delivery: secrets (OTP codes) are dropped, the recipient is already the aggregateId. */
  redactedPayload(): Record<string, unknown> {
    return { redacted: true }
  }

  /** Whether this consumer already succeeded on a previous delivery attempt. */
  hasBeenHandledBy(handlerKey: string): boolean {
    return (this.handledBy ?? []).includes(handlerKey)
  }

  recordHandledBy(handlerKey: string): void {
    this.handledBy = [...(this.handledBy ?? []), handlerKey]
  }

  /** Attempt number after the current failure (retryCount is attempts already failed). */
  attemptsMade(): number {
    return (this.retryCount ?? 0) + 1
  }

  hasExhaustedRetries(maxAttempts: number): boolean {
    return this.attemptsMade() >= maxAttempts
  }

  /** Exponential backoff: 30s, 60s, 120s, ... from the moment of failure. */
  nextRetryAt(now: Date): Date {
    return new Date(now.getTime() + RETRY_BASE_DELAY_MS * 2 ** (this.retryCount ?? 0))
  }

  /**
   * Monitoring projection: everything an operator needs, WITHOUT the payload —
   * payloads carry secrets (OTP codes) and must never
   * leave the system through a read endpoint.
   */
  toOperationalView() {
    return {
      id: this.id,
      aggregateType: this.aggregateType,
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      status: this.status,
      retryCount: this.retryCount,
      lastError: this.lastError,
      nextAttemptAt: this.nextAttemptAt,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      handledBy: this.handledBy,
    }
  }

  toPrimitives() {
    return {
      id: this.id,
      aggregateType: this.aggregateType,
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      payload: this.payload,
      status: this.status,
      retryCount: this.retryCount,
      lastError: this.lastError,
      nextAttemptAt: this.nextAttemptAt,
      publishedAt: this.publishedAt,
      handledBy: this.handledBy,
    }
  }
}
