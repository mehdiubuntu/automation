import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { UserStatus } from '@domain/user/enum/user.enum'

export interface IGetUsersPaginateInput {
  limit?: number
  page?: number
  order?: OrderDirectionEnum
  status?: UserStatus
  search?: string
}

export interface IGetAuthEventsPaginateInput {
  limit?: number
  page?: number
  order?: OrderDirectionEnum
  userId?: string
  type?: AuthEventType
}
