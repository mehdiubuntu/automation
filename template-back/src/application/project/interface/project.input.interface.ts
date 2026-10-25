import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'

export interface ICreateProjectInput {
  name: string
  code?: string
  description?: string
}

export interface IUpdateProjectInput {
  name?: string
  description?: string
  isActive?: boolean
}

export interface IGetProjectsPaginateInput {
  limit?: number
  page?: number
  order?: OrderDirectionEnum
  search?: string
  isActive?: boolean
}
