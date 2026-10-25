import { api } from '@/lib/api/client'
import type {
  AuthUser,
  LoginCredentials,
  LoginResult,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
  VerifyEmailResult,
} from './auth.types'

/**
 * Thin API functions for the public auth flow. All paths are relative to
 * VITE_API_BASE_URL (…/api/v1), so `/auth/login` → …/api/v1/auth/login.
 * Tokens live in HttpOnly cookies — nothing here reads or returns one.
 * (Signed-in account actions — change password, sessions — live in features/account.)
 */
export const authApi = {
  /** 202 with a generic body, whether or not the address was already taken. */
  register(input: RegisterInput) {
    return api.post<unknown>('/auth/register', input)
  },

  verifyEmail(input: VerifyEmailInput) {
    return api.post<VerifyEmailResult>('/auth/verify-email', input)
  },

  /** 202 with a generic body (never reveals whether the account exists). */
  resendVerification(email: string) {
    return api.post<unknown>('/auth/resend-verification', { email })
  },

  login(credentials: LoginCredentials) {
    return api.post<LoginResult>('/auth/login', credentials)
  },

  /** 202 with a generic body; emails a reset code if the account exists. */
  forgotPassword(email: string) {
    return api.post<unknown>('/auth/forgot-password', { email })
  },

  resetPassword(input: ResetPasswordInput) {
    return api.post<unknown>('/auth/reset-password', input)
  },

  /** Rehydrate the session on app boot (the cookies are read server-side). */
  me() {
    return api.get<AuthUser>('/auth/me')
  },

  logout() {
    return api.post<unknown>('/auth/logout')
  },
}
