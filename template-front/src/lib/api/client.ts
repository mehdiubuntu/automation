import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ApiError } from './api-error'
import type { ApiEnvelope, ApiErrorBody } from './types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

if (!BASE_URL) {
  // Fail loud in dev rather than firing requests at a relative path.
  throw new Error('VITE_API_BASE_URL is not set — copy .env.example to .env.development')
}

/**
 * A dedicated axios instance (NOT the global default like the old front did).
 * - `baseURL` set once; callers pass path-only URLs.
 * - `withCredentials` so the HttpOnly auth cookies ride along (the backend
 *   sets accessToken/refreshToken cookies; the client never reads them).
 */
export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── 401 refresh single-flight ────────────────────────────────────────────────
// Concurrent 401s trigger exactly one POST /auth/refresh; the rest queue and
// replay once the new cookies are set. Ported from the old front, cleaned up.

let isRefreshing = false
let waiters: Array<(ok: boolean) => void> = []

function flushWaiters(ok: boolean) {
  waiters.forEach((resolve) => resolve(ok))
  waiters = []
}

/** Endpoints that must never trigger the refresh loop (they ARE the auth flow). */
const AUTH_BYPASS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
  '/auth/logout',
]

/** Callback the auth store registers to react to an unrecoverable 401. */
let onAuthLost: (() => void) | null = null
export function setOnAuthLost(cb: () => void) {
  onAuthLost = cb
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => config)

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status
    const url = original?.url ?? ''

    // A 401 that says "wrong password" (e.g. change-password) is a validation
    // outcome, not an expired session: never refresh-loop or sign the user out.
    const isCredentialError = error.response?.data?.error?.errorCode === 'AUTH_INVALID_CREDENTIALS'
    const isAuthCall = isCredentialError || AUTH_BYPASS.some((p) => url.startsWith(p))

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true

      if (isRefreshing) {
        // Wait for the in-flight refresh, then replay.
        const ok = await new Promise<boolean>((resolve) => waiters.push(resolve))
        if (ok) return http(original)
        return Promise.reject(toApiError(error))
      }

      isRefreshing = true
      try {
        await http.post('/auth/refresh')
        isRefreshing = false
        flushWaiters(true)
        return http(original)
      } catch (refreshErr) {
        isRefreshing = false
        flushWaiters(false)
        onAuthLost?.()
        return Promise.reject(toApiError(refreshErr as AxiosError<ApiEnvelope<unknown>>))
      }
    }

    if (status === 401 && !isAuthCall) {
      onAuthLost?.()
    }

    return Promise.reject(toApiError(error))
  }
)

function toApiError(error: AxiosError<ApiEnvelope<unknown>>): ApiError {
  const status = error.response?.status ?? 0
  const body = error.response?.data?.error as ApiErrorBody | null | undefined
  return new ApiError(status, body, error.message)
}

// ── Typed verb helpers ───────────────────────────────────────────────────────
// Each unwraps the { success, data, error } envelope and returns `data` directly.
// On a 2xx with `success:false` (shouldn't happen) or a null body we still
// return what the server sent, typed as T.

async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const res = await promise
  return res.data.data as T
}

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => unwrap<T>(http.get<ApiEnvelope<T>>(url, config)),
  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    unwrap<T>(http.post<ApiEnvelope<T>>(url, body, config)),
  put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    unwrap<T>(http.put<ApiEnvelope<T>>(url, body, config)),
  patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    unwrap<T>(http.patch<ApiEnvelope<T>>(url, body, config)),
  delete: <T>(url: string, config?: AxiosRequestConfig) => unwrap<T>(http.delete<ApiEnvelope<T>>(url, config)),
}
