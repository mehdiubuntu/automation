import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, ErrorState, LoadingRows } from '@/components/feedback/States'
import { SessionList } from './SessionList'
import { useLogoutAll, useRevokeOtherSessions, useRevokeSession, useSessions } from './account.hooks'
import type { Session } from './account.types'

type Pending = { kind: 'revoke'; session: Session } | { kind: 'others' } | { kind: 'all' } | null

export function SessionsCard() {
  const { data, isLoading, isError, refetch } = useSessions()
  const revoke = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()
  const logoutAll = useLogoutAll()
  const [pending, setPending] = useState<Pending>(null)

  const sessions = data ?? []
  const hasOthers = sessions.some((s) => !s.isCurrent)
  const busy = revoke.isPending || revokeOthers.isPending || logoutAll.isPending

  const confirm = () => {
    if (!pending) return
    const done = { onSettled: () => setPending(null) }
    if (pending.kind === 'revoke') revoke.mutate(pending.session, done)
    else if (pending.kind === 'others') revokeOthers.mutate(undefined, done)
    else logoutAll.mutate(undefined, done)
  }

  const dialog =
    pending?.kind === 'revoke'
      ? {
          title: 'Revoke session',
          message: pending.session.isCurrent
            ? 'This is the device you are using right now. Revoking it will sign you out.'
            : 'That device will be signed out immediately.',
          label: 'Revoke',
        }
      : pending?.kind === 'others'
        ? {
            title: 'Sign out other devices',
            message: 'Every other device will be signed out. This device stays signed in.',
            label: 'Sign out others',
          }
        : {
            title: 'Sign out everywhere',
            message: 'All devices, including this one, will be signed out.',
            label: 'Sign out everywhere',
          }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Active sessions</h2>
            <p className="mt-0.5 text-sm text-gray-500">Devices currently signed in to your account.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={!hasOthers || busy} onClick={() => setPending({ kind: 'others' })}>
              Sign out other devices
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setPending({ kind: 'all' })}>
              Sign out everywhere
            </Button>
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <LoadingRows rows={3} />
          ) : isError ? (
            <ErrorState message="Could not load sessions." onRetry={() => void refetch()} />
          ) : sessions.length === 0 ? (
            <EmptyState title="No active sessions" />
          ) : (
            <SessionList
              sessions={sessions}
              onRevoke={(session) => setPending({ kind: 'revoke', session })}
              revokingId={revoke.isPending ? (revoke.variables?.id ?? null) : null}
            />
          )}
        </div>
      </CardBody>

      <ConfirmDialog
        open={pending !== null}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.label}
        tone="danger"
        pending={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </Card>
  )
}
