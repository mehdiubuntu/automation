import { ExampleItem } from '@domain/example-item/aggregate/example-item.aggregate'
import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'

export const EXAMPLE_ITEM_REPOSITORY_TOKEN = Symbol('EXAMPLE_ITEM_REPOSITORY_TOKEN')

/** Project-scoped port: names are unique per project among live rows; reads exclude soft-deleted rows. */
export interface IExampleItemRepository {
  insertOne(entity: ExampleItem): Promise<ExampleItem>
  findById(id: string): Promise<ExampleItem | null>
  findByNameInProject(projectId: string, name: string): Promise<ExampleItem | null>
  findExampleItems(query: {
    projectId: string
    limit?: number
    page?: number
    order?: OrderDirectionEnum
    name?: string
    isActive?: boolean
  }): Promise<IPaginatedResponse<ExampleItem>>
  updateById(id: string, entity: ExampleItem): Promise<ExampleItem | null>
  /** Soft delete (sets deletedAt) - returns whether a row was removed. */
  softDeleteById(id: string): Promise<boolean>
}
