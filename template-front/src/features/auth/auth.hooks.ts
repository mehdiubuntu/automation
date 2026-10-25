import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/components/feedback/toast'
import { authApi } from './auth.api'
import { authErrorMessage } from './auth.errors'
import { useAuthStore } from './auth.store'
import type { LoginCredentials, RegisterInput, ResetPasswordInput, VerifyEmailInput } from './auth.types'

/**
 * Sign in. Errors are NOT toasted here: the login page maps each `errorCode`
 * to its own inline message (and, for unverified emails, routes to the OTP screen).
 */
export function useLogin() {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated)
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: ({ user }) => setAuthenticated(user),
  })
}

/** Register. Errors (validation) are shown inline by the page. */
export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
  })
}

/** Verify the emailed code. Errors are shown inline by the page. */
export function useVerifyEmail() {
  return useMutation({
    mutationFn: (input: VerifyEmailInput) => authApi.verifyEmail(input),
  })
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
    onSuccess: () => toast.success('If that account is waiting for verification, a new code is on its way.'),
    onError: (err) => toast.error(authErrorMessage(err)),
  })
}

/** Request a reset code. The page shows a generic confirmation either way. */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => authApi.resetPassword(input),
  })
}

/** End the session on the server, then clear it locally (also used after self-revocation). */
export function useLogout() {
  const endLocalSession = useEndLocalSession()
  return useMutation({
    mutationFn: () => authApi.logout(),
    // Whatever the server says, this browser is done with the session.
    onSettled: endLocalSession,
  })
}

/** Clears the client session and goes to /login. For flows where the server already ended it. */
export function useEndLocalSession() {
  const navigate = useNavigate()
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated)
  return () => {
    setUnauthenticated()
    navigate('/login', { replace: true })
  }
}
