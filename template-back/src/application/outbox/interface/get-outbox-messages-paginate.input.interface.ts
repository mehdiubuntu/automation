import { OutboxEventType, OutboxStatus } from '@domain/outbox/enum/outbox.enum'
import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'

export interface IGetOutboxMessagesPaginateInput {
  limit?: number
  page?: number
  order?: OrderDirectionEnum
  status?: OutboxStatus
  eventType?: OutboxEventType
  aggregateId?: string
}
