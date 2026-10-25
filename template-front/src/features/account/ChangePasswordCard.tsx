import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { PasswordRules } from '@/features/auth/PasswordRules'
import { isPasswordValid } from '@/features/auth/password-policy'
import { useChangePassword } from './account.hooks'

export function ChangePasswordCard() {
  const change = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')

  const mismatch = confirm.length > 0 && confirm !== next
  const canSubmit = current !== '' && isPasswordValid(next) && next === confirm

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (change.isPending || !canSubmit) return
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setConfirm('')
        },
      },
    )
  }

  return (
    <Card>
      <CardBody>
        <h2 className="text-base font-semibold text-gray-900">Change password</h2>
        <p className="mt-0.5 text-sm text-gray-500">Use a password you do not use anywhere else.</p>
        <form onSubmit={submit} className="mt-4 max-w-md space-y-4">
          <Field label="Current password" htmlFor="current-password">
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="New password" htmlFor="new-password">
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <PasswordRules password={next} />
          <Field label="Confirm new password" htmlFor="confirm-new-password" error={mismatch ? 'Passwords do not match.' : undefined}>
            <PasswordInput
              id="confirm-new-password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={change.isPending} disabled={!canSubmit}>
            Change password
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
