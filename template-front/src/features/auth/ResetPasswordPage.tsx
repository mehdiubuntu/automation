import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from '@/components/feedback/toast'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { OtpInput } from '@/components/ui/OtpInput'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { AuthPageShell } from './AuthLayout'
import { PasswordRules } from './PasswordRules'
import { otpErrorMessage } from './auth.errors'
import { useResetPassword } from './auth.hooks'
import type { ResetPasswordLocationState } from './auth.nav'
import { OTP_LENGTH } from './auth.types'
import { isPasswordValid } from './password-policy'

/** Step 2 of password reset: email + emailed code + new password. Success goes to /login with a toast. */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const reset = useResetPassword()

  const [email, setEmail] = useState(() => (location.state as ResetPasswordLocationState | null)?.email ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirm.length > 0 && confirm !== password
  const canSubmit =
    email.trim() !== '' && code.length === OTP_LENGTH && isPasswordValid(password) && password === confirm

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (reset.isPending || !canSubmit) return
    setError(null)
    reset.mutate(
      { email: email.trim(), code, newPassword: password },
      {
        onSuccess: () => {
          toast.success('Password updated. Sign in with your new password.')
          navigate('/login', { replace: true })
        },
        onError: (err) => setError(otpErrorMessage(err)),
      },
    )
  }

  return (
    <AuthPageShell title="Choose a new password" subtitle="Enter the code we emailed you and pick a new password.">
      {error && (
        <div role="alert" className="mb-4 whitespace-pre-line rounded-[11px] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" htmlFor="reset-email">
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Code" htmlFor="reset-code">
          <OtpInput
            id="reset-code"
            label="Reset code"
            value={code}
            onChange={setCode}
            invalid={Boolean(error)}
            autoFocus={email !== ''}
          />
        </Field>
        <Field label="New password" htmlFor="reset-password">
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <PasswordRules password={password} />
        <Field label="Confirm new password" htmlFor="reset-confirm" error={mismatch ? 'Passwords do not match.' : undefined}>
          <PasswordInput
            id="reset-confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button type="submit" className="auth-primary-btn mt-2 w-full" loading={reset.isPending} disabled={!canSubmit}>
          Update password
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[#6b7280]">
        Need a new code?{' '}
        <Link to="/forgot-password" className="font-medium text-[#3b0764] hover:underline">
          Start over
        </Link>
      </p>
    </AuthPageShell>
  )
}
