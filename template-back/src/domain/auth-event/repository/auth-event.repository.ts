import { AuthEvent } from '@domain/auth-event/aggregate/auth-event.aggregate'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'

export const AUTH_EVENT_REPOSITORY_TOKEN = Symbol('AUTH_EVENT_REPOSITORY_TOKEN')

export interface IAuthEventRepository {
  insertOne(entity: AuthEvent): Promise<AuthEvent>
  findEvents(query: { limit?: number; page?: number; order?: OrderDirectionEnum; userId?: string; type?: AuthEventType }): Promise<IPaginatedResponse<AuthEvent>>
  deleteOlderThan(cutoff: Date): Promise<number>
}
