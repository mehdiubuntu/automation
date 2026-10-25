import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'

export interface ICreateExampleItemInput {
  projectId: string
  name: string
  description?: string
}

export interface IUpdateExampleItemInput {
  name?: string
  description?: string
  isActive?: boolean
}

export interface IGetExampleItemsPaginateInput {
  projectId: string
  limit?: number
  page?: number
  order?: OrderDirectionEnum
  name?: string
  isActive?: boolean
}
