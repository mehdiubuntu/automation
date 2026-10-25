import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { ApiError } from '@/lib/api/api-error'
import { AuthSplitLayout } from './AuthLayout'
import { useLogin } from './auth.hooks'
import { isRateLimited } from './auth.errors'
import { safeRedirect, type LoginLocationState, type VerifyEmailLocationState } from './auth.nav'
import { useAuthStore } from './auth.store'
import { isLoginErrorCode, type LoginErrorCode } from './auth.types'

const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  AUTH_INVALID_CREDENTIALS: 'Incorrect email or password.',
  // Not shown: this code routes straight to the code-entry screen. Kept for exhaustiveness.
  AUTH_EMAIL_NOT_VERIFIED: 'Please verify your email address before signing in.',
  AUTH_PENDING_APPROVAL: 'Your email is verified. Your account is waiting for an administrator to approve it.',
  AUTH_BLOCKED: 'This account has been blocked. Contact an administrator if you think this is a mistake.',
  AUTH_LOCKED: 'Too many failed attempts. This account is temporarily locked. Please try again later.',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()
  const sessionLost = useAuthStore((s) => s.sessionLost)
  const clearSessionLost = useAuthStore((s) => s.clearSessionLost)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Latch the notice on mount, then clear the store flag so it does not reappear later.
  const [showSignedOut] = useState(sessionLost)
  useEffect(() => {
    if (sessionLost) clearSessionLost()
  }, [sessionLost, clearSessionLost])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (login.isPending) return
    setError(null)
    const trimmed = email.trim()
    login.mutate(
      { email: trimmed, password },
      {
        onSuccess: () => {
          setPassword('')
          navigate(safeRedirect((location.state as LoginLocationState | null)?.from), { replace: true })
        },
        onError: (err) => {
          const code = err instanceof ApiError ? err.errorCode : undefined
          if (code === 'AUTH_EMAIL_NOT_VERIFIED') {
            // Same OTP screen as after registering; the user can resend from there.
            const state: VerifyEmailLocationState = { email: trimmed }
            navigate('/verify-email', { state })
          } else if (isLoginErrorCode(code)) {
            setError(LOGIN_ERROR_MESSAGES[code])
          } else if (isRateLimited(err)) {
            setError('Too many attempts. Please wait a few minutes and try again.')
          } else {
            setError('Sign in failed. Please try again.')
          }
        },
      },
    )
  }

  return (
    <AuthSplitLayout>
      <div className="my-auto w-[min(86%,460px)] py-7">
        <p className="mb-3.5 font-mono text-sm uppercase tracking-[0.24em] text-lime-600">App</p>
        <h1 className="font-display text-[clamp(28px,2.5vw,64px)] font-normal leading-[1.04] text-[var(--auth-heading)]">
          Welcome back
        </h1>
        <p className="mb-7 mt-2.5 text-[#6b7280]">Sign in to your workspace.</p>

        {showSignedOut && !error && (
          <div role="status" className="mb-4 rounded-[11px] bg-[#eff6ff] px-4 py-3 text-sm text-[#1d4ed8]">
            You were signed out. Please sign in again.
          </div>
        )}
        {error && (
          <div role="alert" className="mb-4 rounded-[11px] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <PasswordInput
              id="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <div className="-mt-1 flex items-center justify-end">
            <Link to="/forgot-password" className="text-[13px] font-medium text-[#3b0764] hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="auth-primary-btn mt-2 w-full" loading={login.isPending}>
            Sign me in
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-[#6b7280]">
          No account yet?{' '}
          <Link to="/register" className="font-medium text-[#3b0764] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  )
}
