/**
 * Wire types matching the backend's global ResponseInterceptor and
 * global exception filter. The client unwraps these so callers only ever
 * see `data` (on success) or a thrown ApiError (on failure).
 */

export interface ApiEnvelope<T> {
  success: boolean
  message: string
  statusCode: number
  data: T | null
  error: ApiErrorBody | null
}

export interface ApiErrorBody {
  /** Validation failures send one message per broken rule. */
  message: string | string[]
  errorCode?: string
  timestamp?: string
}

/** Paginated list shape — matches the backend IPaginatedResponse exactly. */
export interface Paginated<T> {
  data: T[]
  meta: {
    itemsPerPage: number
    totalItems: number
    currentPage: number
    totalPages: number
  }
}

/** Common list query params (base PaginationQueryDto). */
export interface PaginationParams {
  page?: number
  limit?: number
  order?: 'ASC' | 'DESC'
}
