export enum OutboxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
  /** Withdrawn by an administrator before delivery. Terminal, but recoverable by retry. */
  CANCELLED = 'CANCELLED',
}

export enum OutboxAggregateType {
  EMAIL = 'EMAIL',
}

export enum OutboxEventType {
  SEND_EMAIL_VERIFICATION_OTP = 'SEND_EMAIL_VERIFICATION_OTP',
  SEND_PASSWORD_RESET_OTP = 'SEND_PASSWORD_RESET_OTP',
  SEND_PASSWORD_CHANGED_NOTICE = 'SEND_PASSWORD_CHANGED_NOTICE',
  SEND_PASSWORD_RESET_COMPLETED_NOTICE = 'SEND_PASSWORD_RESET_COMPLETED_NOTICE',
}

/**
 * Business events (as opposed to the direct email sends above). The template ships none:
 * list a persist-only event type here, or write an IOutboxEventHandler and register it
 * in OUTBOX_EVENT_HANDLERS to consume it.
 */
export const DOMAIN_EVENT_TYPES: readonly OutboxEventType[] = []
