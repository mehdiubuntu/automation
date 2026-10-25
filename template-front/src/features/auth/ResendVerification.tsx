import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useResendVerification } from './auth.hooks'

/** Seconds between resend requests (the server rate-limits as well). */
export const RESEND_COOLDOWN_SECONDS = 60

/**
 * "Resend code" button with a cooldown timer. `initialCooldown` is used when a
 * code was just sent (e.g. right after registering) so the button starts locked.
 */
export function ResendVerification({
  email,
  initialCooldown = 0,
  label = 'Resend code',
}: {
  email: string
  initialCooldown?: number
  label?: string
}) {
  const resend = useResendVerification()
  const [cooldown, setCooldown] = useState(initialCooldown)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const send = () => {
    if (resend.isPending || cooldown > 0 || !email) return
    resend.mutate(email, { onSuccess: () => setCooldown(RESEND_COOLDOWN_SECONDS) })
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      loading={resend.isPending}
      disabled={!email || cooldown > 0}
      onClick={send}
    >
      {cooldown > 0 ? `${label} in ${cooldown}s` : label}
    </Button>
  )
}
