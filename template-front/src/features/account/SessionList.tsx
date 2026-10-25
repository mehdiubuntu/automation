import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatRelativeTime, orDash } from '@/lib/utils/format'
import type { Session } from './account.types'

/**
 * Presentational list of sessions, shared by the Account page and the
 * superadmin per-user sessions modal. Pass `onRevoke` to show a Revoke button.
 */
export function SessionList({
  sessions,
  onRevoke,
  revokingId,
}: {
  sessions: Session[]
  onRevoke?: (session: Session) => void
  revokingId?: Session['id'] | null
}) {
  return (
    <ul className="divide-y divide-gray-100">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <span className="truncate">{orDash(s.deviceLabel)}</span>
              {s.isCurrent && <Badge tone="green">This device</Badge>}
            </p>
            <p className="truncate text-xs text-gray-500">
              {orDash(s.ip)} · active {formatRelativeTime(s.lastActiveAt ?? s.createdAt)}
            </p>
          </div>
          {onRevoke && (
            <Button
              size="sm"
              variant="secondary"
              loading={revokingId === s.id}
              disabled={revokingId !== null && revokingId !== undefined}
              onClick={() => onRevoke(s)}
            >
              Revoke
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
