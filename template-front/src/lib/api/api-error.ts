import type { ApiErrorBody } from './types'

/**
 * A normalized error thrown by the API client on any non-2xx response.
 * Unlike the old front's `{ isSuccess:false }` sentinel, this THROWS so that
 * React Query's `isError`/`error`/`retry` all work and callers can `try/catch`.
 */
export class ApiError extends Error {
  readonly statusCode: number
  readonly errorCode?: string
  readonly timestamp?: string

  constructor(statusCode: number, body?: ApiErrorBody | null, fallbackMessage = 'Request failed') {
    // Validation errors arrive as one message per broken rule; an array (or an
    // empty one) coerced into Error.message used to render a blank toast.
    const raw = Array.isArray(body?.message) ? body.message.join('\n') : body?.message
    super(raw || fallbackMessage)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.errorCode = body?.errorCode
    this.timestamp = body?.timestamp
  }

  /** True for auth failures the app treats specially (redirect to login). */
  get isUnauthorized(): boolean {
    return this.statusCode === 401
  }
}
