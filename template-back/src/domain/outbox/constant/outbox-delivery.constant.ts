/**
 * The delivery rules in force. Exported so the console can DISPLAY them — an
 * administrator interpreting queue behaviour should not have to guess at the
 * batch size or the backoff curve (§38.5). The dispatcher reads the same values.
 */
export const OUTBOX_DELIVERY_CONFIG = {
  batchSize: 50,
  /** Claimed batch is dispatched by a bounded worker pool — one slow SMTP round must not serialize the tick. */
  dispatchConcurrency: 8,
  maxAttempts: 3,
  /** Backoff is base × 2^attempt: 30s, 60s, 120s. */
  backoffBaseSeconds: 30,
  pollIntervalSeconds: 5,
  staleProcessingMinutes: 5,
  publishedRetentionDays: 7,
} as const
