import { OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { OutboxEventType } from '@domain/outbox/enum/outbox.enum'

export const OUTBOX_EVENT_HANDLERS = Symbol('OUTBOX_EVENT_HANDLERS')

/**
 * One outbox consumer. The dispatcher fans a claimed message out to every
 * registered handler that supports its event type; `key` is recorded on the row
 * (`handledBy`) after each success, so a retry re-runs only the handlers that
 * have not yet succeeded — never duplicating an already-delivered side effect.
 */
export interface IOutboxEventHandler {
  /** Stable identity persisted in Outbox.handledBy — never rename once live. */
  readonly key: string
  supportedEventTypes(): OutboxEventType[]
  handle(message: OutboxMessage): Promise<void>
}
