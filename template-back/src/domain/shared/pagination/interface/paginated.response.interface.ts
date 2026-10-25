export interface IPaginatedResponse<T> {
  data: T[]

  meta: {
    itemsPerPage: number
    totalItems: number
    currentPage: number
    totalPages: number
  }
}
