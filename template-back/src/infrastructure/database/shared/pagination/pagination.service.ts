import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'
import { FindManyOptions, FindOptionsOrder, ObjectLiteral, Repository } from 'typeorm'

export interface SortItem<T> {
  sortBy: keyof T
  order: OrderDirectionEnum
}

export interface PaginationParams<T> {
  page?: number
  limit?: number
  sort?: SortItem<T>[]
}

const MAX_LIMIT = 100

export async function findPaginate<TEntity extends ObjectLiteral, TDomain>({
  repository,
  mapper,
  options,
  params,
}: {
  repository: Repository<TEntity>
  mapper: { toDomain(entity: TEntity): TDomain }
  options?: FindManyOptions<TEntity>
  params?: PaginationParams<TEntity>
}): Promise<IPaginatedResponse<TDomain>> {
  params = params || {}

  // Pagination defaults
  const page = params.page && params.page > 0 ? params.page : 1
  const limit = params.limit && params.limit > 0 ? Math.min(params.limit, MAX_LIMIT) : 10
  const skip = (page - 1) * limit

  // Sorting defaults
  const sortItems: SortItem<TEntity>[] =
    params.sort && params.sort.length > 0
      ? params.sort
      : [
          {
            sortBy: 'createdAt',
            order: OrderDirectionEnum.DESC,
          },
        ]

  // Build multi-column order object
  const orderObj = sortItems.reduce(
    (acc, item) => {
      acc[item.sortBy as string] = item.order
      return acc
    },
    {} as Record<string, OrderDirectionEnum>
  ) as FindOptionsOrder<TEntity>

  // Fetch data
  const [data, totalItems] = await repository.findAndCount({
    ...options,
    skip,
    take: limit,
    order: orderObj,
  })
  // Build paginated response
  return {
    data: data.map((entity) => mapper.toDomain(entity)),
    meta: {
      itemsPerPage: limit,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
    },
  }
}
