import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, LoadingRows } from '@/components/feedback/States'
import { SessionList } from '@/features/account/SessionList'
import { useRevokeUserSessions, useUserSessions } from './user.hooks'
import type { ManagedUser } from './user.types'

/** Superadmin view of one user's signed-in devices, with "revoke all". */
export function UserSessionsModal({ user, onClose }: { user: ManagedUser | null; onClose: () => void }) {
  const { data, isLoading, isError, refetch } = useUserSessions(user?.id ?? null)
  const revoke = useRevokeUserSessions()
  const [confirming, setConfirming] = useState(false)

  const sessions = data ?? []

  return (
    <>
      <Modal open={user !== null} onClose={onClose} title={user ? `Sessions: ${user.email}` : 'Sessions'}>
        {isLoading ? (
          <LoadingRows rows={3} />
        ) : isError ? (
          <ErrorState message="Could not load sessions." onRetry={() => void refetch()} />
        ) : sessions.length === 0 ? (
          <EmptyState title="No active sessions" />
        ) : (
          <>
            <SessionList sessions={sessions} />
            <div className="flex justify-end pt-3">
              <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
                Revoke all sessions
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={confirming}
        title="Revoke all sessions"
        message={`${user?.email ?? 'This user'} will be signed out of every device.`}
        confirmLabel="Revoke all"
        tone="danger"
        pending={revoke.isPending}
        onConfirm={() => user && revoke.mutate(user.id, { onSettled: () => setConfirming(false) })}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
