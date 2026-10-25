import { ApiError } from '@/lib/api/api-error'

const OTP_MESSAGES: Record<string, string> = {
  AUTH_INVALID_OTP: 'That code is not correct. Check the email and try again.',
  AUTH_OTP_EXPIRED: 'That code has expired. Request a new one.',
  AUTH_OTP_ATTEMPTS_EXCEEDED: 'Too many incorrect attempts. Request a new code.',
}

const RATE_LIMITED_MESSAGE = 'Too many requests. Please wait a few minutes and try again.'

export function isRateLimited(err: unknown): boolean {
  return err instanceof ApiError && (err.statusCode === 429 || err.errorCode === 'AUTH_RATE_LIMITED')
}

/** True when the code can no longer be used and the user must ask for a fresh one. */
export function otpNeedsResend(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.errorCode === 'AUTH_OTP_EXPIRED' || err.errorCode === 'AUTH_OTP_ATTEMPTS_EXCEEDED')
  )
}

/** Friendly message for a failed OTP submit (verify-email / reset-password). */
export function otpErrorMessage(err: unknown): string {
  if (isRateLimited(err)) return RATE_LIMITED_MESSAGE
  if (err instanceof ApiError) {
    if (err.errorCode && OTP_MESSAGES[err.errorCode]) return OTP_MESSAGES[err.errorCode]
    if (err.statusCode === 400 && err.message) return err.message
  }
  return 'Something went wrong. Please try again.'
}

/** Friendly message for any other auth failure; falls back to the server message on 4xx validation errors. */
export function authErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isRateLimited(err)) return RATE_LIMITED_MESSAGE
  if (err instanceof ApiError && err.statusCode >= 400 && err.statusCode < 500 && err.message) return err.message
  return fallback
}
