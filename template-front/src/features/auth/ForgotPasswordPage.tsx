import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { AuthPageShell } from './AuthLayout'
import { authErrorMessage } from './auth.errors'
import { useForgotPassword } from './auth.hooks'
import type { ResetPasswordLocationState } from './auth.nav'

/**
 * Step 1 of password reset: ask for the account email. The confirmation is
 * deliberately generic (same text whether or not the address has an account).
 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const forgot = useForgotPassword()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (forgot.isPending) return
    setError(null)
    const trimmed = email.trim()
    forgot.mutate(trimmed, {
      onSuccess: () => setSentTo(trimmed),
      onError: (err) => setError(authErrorMessage(err)),
    })
  }

  if (sentTo) {
    const state: ResetPasswordLocationState = { email: sentTo }
    return (
      <AuthPageShell
        title="Check your email"
        subtitle={`If an account exists for ${sentTo}, we have sent a 6-digit code to reset your password. The code expires shortly.`}
      >
        <Button className="auth-primary-btn w-full" onClick={() => navigate('/reset-password', { state })}>
          I have a code
        </Button>
        <p className="mt-6 text-center text-[13px] text-[#6b7280]">
          <Link to="/login" className="font-medium text-[#3b0764] hover:underline">
            Back to sign-in
          </Link>
        </p>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      title="Reset your password"
      subtitle="Enter the email tied to your account and we will send you a code to set a new password."
    >
      {error && (
        <div role="alert" className="mb-4 rounded-[11px] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" htmlFor="forgot-email">
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" className="auth-primary-btn mt-2 w-full" loading={forgot.isPending}>
          Send reset code
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[#6b7280]">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-[#3b0764] hover:underline">
          Back to sign-in
        </Link>
      </p>
    </AuthPageShell>
  )
}
