import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { AuthPageShell } from './AuthLayout'
import { PasswordRules } from './PasswordRules'
import { authErrorMessage } from './auth.errors'
import { useRegister } from './auth.hooks'
import type { VerifyEmailLocationState } from './auth.nav'
import { isPasswordValid } from './password-policy'

export default function RegisterPage() {
  const navigate = useNavigate()
  const register = useRegister()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirm.length > 0 && confirm !== password
  const canSubmit = email.trim() !== '' && isPasswordValid(password) && password === confirm

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (register.isPending || !canSubmit) return
    setError(null)
    const trimmed = email.trim()
    register.mutate(
      { email: trimmed, password },
      {
        onSuccess: () => {
          // Drop the password from memory; only the email travels to the code screen.
          setPassword('')
          setConfirm('')
          const state: VerifyEmailLocationState = { email: trimmed, codeSent: true }
          navigate('/verify-email', { state })
        },
        onError: (err) => setError(authErrorMessage(err, 'Registration failed. Please try again.')),
      },
    )
  }

  return (
    <AuthPageShell title="Create your account" subtitle="Register with your email. An administrator approves new accounts.">
      {error && (
        <div role="alert" className="mb-4 whitespace-pre-line rounded-[11px] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" htmlFor="register-email">
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="register-password">
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <PasswordRules password={password} />
        <Field label="Confirm password" htmlFor="register-confirm" error={mismatch ? 'Passwords do not match.' : undefined}>
          <PasswordInput
            id="register-confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button type="submit" className="auth-primary-btn mt-2 w-full" loading={register.isPending} disabled={!canSubmit}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[#6b7280]">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-[#3b0764] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthPageShell>
  )
}
