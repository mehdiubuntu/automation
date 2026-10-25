import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { OtpInput } from '@/components/ui/OtpInput'
import { AuthPageShell } from './AuthLayout'
import { ResendVerification, RESEND_COOLDOWN_SECONDS } from './ResendVerification'
import { useVerifyEmail } from './auth.hooks'
import { otpErrorMessage } from './auth.errors'
import type { VerifyEmailLocationState } from './auth.nav'
import { OTP_LENGTH } from './auth.types'

/**
 * Email verification by 6-digit code: /verify-email. The address arrives in
 * router state (from register/login) or `?email=`; if neither is present the
 * user types it. The code is only ever held in component state, never
 * stored or logged, and the password is never carried here.
 */
export default function VerifyEmailPage() {
  const location = useLocation()
  const state = location.state as VerifyEmailLocationState | null
  const [email, setEmail] = useState<string>(
    () => state?.email ?? new URLSearchParams(location.search).get('email') ?? '',
  )
  const [emailConfirmed, setEmailConfirmed] = useState(() => email.trim() !== '')

  if (!emailConfirmed) {
    return (
      <AuthPageShell title="Verify your email" subtitle="Enter the address you registered with.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim()) setEmailConfirmed(true)
          }}
        >
          <Field label="Email" htmlFor="verify-email-address">
            <Input
              id="verify-email-address"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" className="auth-primary-btn w-full">
            Continue
          </Button>
        </form>
      </AuthPageShell>
    )
  }

  return <CodeEntry email={email.trim()} codeSent={state?.codeSent ?? false} />
}

function CodeEntry({ email, codeSent }: { email: string; codeSent: boolean }) {
  const verify = useVerifyEmail()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Remounting the OTP boxes after a failure clears + refocuses them.
  const [otpKey, setOtpKey] = useState(0)

  const submit = (value: string) => {
    if (verify.isPending || value.length !== OTP_LENGTH) return
    setError(null)
    verify.mutate(
      { email, code: value },
      {
        onError: (err) => {
          setError(otpErrorMessage(err))
          setCode('')
          setOtpKey((k) => k + 1)
        },
      },
    )
  }

  if (verify.isSuccess) {
    const active = verify.data?.status === 'ACTIVE'
    return (
      <AuthPageShell
        title="Email verified"
        subtitle={
          active
            ? 'Your account is active. You can sign in now.'
            : 'Thanks! An administrator now needs to approve your account. You will be able to sign in once that is done.'
        }
      >
        <Link to="/login">
          <Button className="auth-primary-btn w-full">Go to sign-in</Button>
        </Link>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      title="Check your email"
      subtitle={`If ${email} can be verified, we have sent it a ${OTP_LENGTH}-digit code. Enter it below.`}
    >
      {error && (
        <div role="alert" className="mb-4 rounded-[11px] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {error}
        </div>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit(code)
        }}
      >
        <OtpInput
          key={otpKey}
          autoFocus
          label="Verification code"
          value={code}
          onChange={setCode}
          onComplete={submit}
          disabled={verify.isPending}
          invalid={Boolean(error)}
        />
        <Button
          type="submit"
          className="auth-primary-btn w-full"
          loading={verify.isPending}
          disabled={code.length !== OTP_LENGTH}
        >
          Verify email
        </Button>
      </form>

      <div className="mt-4 space-y-3">
        <ResendVerification email={email} initialCooldown={codeSent ? RESEND_COOLDOWN_SECONDS : 0} />
        <Link to="/login" className="block text-center text-[13px] font-medium text-[#3b0764] hover:underline">
          Back to sign-in
        </Link>
      </div>
    </AuthPageShell>
  )
}
