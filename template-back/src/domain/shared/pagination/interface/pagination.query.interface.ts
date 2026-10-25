import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'

export class IPaginationQuery {
  limit?: number
  page?: number
  order?: OrderDirectionEnum
}
