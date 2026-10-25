import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Table, THead, TH, TR, TD, TBody } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState, LoadingRows } from '@/components/feedback/States'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { formatDate } from '@/lib/utils/format'
import { useAuth } from '@/features/auth/useAuth'
import { ROLE_LABELS } from '@/features/auth/auth.types'
import { AuthActivityModal } from './AuthActivityModal'
import { UserSessionsModal } from './UserSessionsModal'
import { UserStatusBadge } from './UserStatusBadge'
import { useUserAction, useUsers } from './user.hooks'
import { USER_STATUS_LABELS, type ManagedUser, type UserAction, type UserStatus } from './user.types'

/** Status tabs, in the order a superadmin works through them. '' = no filter. */
const TABS: Array<{ value: UserStatus | ''; label: string }> = [
  { value: 'PENDING_APPROVAL', label: USER_STATUS_LABELS.PENDING_APPROVAL },
  { value: 'ACTIVE', label: USER_STATUS_LABELS.ACTIVE },
  { value: 'BLOCKED', label: USER_STATUS_LABELS.BLOCKED },
  { value: 'PENDING_VERIFICATION', label: USER_STATUS_LABELS.PENDING_VERIFICATION },
  { value: '', label: 'All' },
]

/** Which moderation actions apply to a status. */
const ACTIONS_BY_STATUS: Record<UserStatus, UserAction[]> = {
  PENDING_VERIFICATION: [],
  PENDING_APPROVAL: ['approve', 'reject'],
  ACTIVE: ['block'],
  BLOCKED: ['unblock'],
}

const ACTION_COPY: Record<UserAction, { label: string; verb: string; danger: boolean }> = {
  approve: { label: 'Approve', verb: 'approve', danger: false },
  reject: { label: 'Reject', verb: 'reject', danger: true },
  block: { label: 'Block', verb: 'block', danger: true },
  unblock: { label: 'Unblock', verb: 'unblock', danger: false },
}

/** Superadmin-only (route guarded by RequireRole). */
export default function UsersPage() {
  const { user: me } = useAuth()

  const [tab, setTab] = useState<UserStatus | ''>('PENDING_APPROVAL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [confirming, setConfirming] = useState<{ user: ManagedUser; action: UserAction } | null>(null)
  const [sessionsFor, setSessionsFor] = useState<ManagedUser | null>(null)
  // Activity: undefined = closed; null = whole system; user = one user. The key remounts it per open.
  const [activityFor, setActivityFor] = useState<ManagedUser | null | undefined>(undefined)
  const [activityKey, setActivityKey] = useState(0)

  const debouncedSearch = useDebounce(search)
  const query = useMemo(
    () => ({ page, limit: 10, order: 'DESC' as const, status: tab || undefined, search: debouncedSearch || undefined }),
    [page, tab, debouncedSearch],
  )

  const { data, isLoading, isError, refetch } = useUsers(query)
  const act = useUserAction()

  const openActivity = (target: ManagedUser | null) => {
    setActivityKey((k) => k + 1)
    setActivityFor(target)
  }

  const copy = confirming ? ACTION_COPY[confirming.action] : null

  return (
    <div className="p-8">
      <PageHeader
        title="Users"
        subtitle="Approve registrations and manage access."
        actions={
          <Button variant="secondary" onClick={() => openActivity(null)}>
            All activity
          </Button>
        }
      />

      <div role="tablist" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.value || 'all'}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => {
              setTab(t.value)
              setPage(1)
            }}
            className={
              tab === t.value
                ? '-mb-px border-b-2 border-brand-600 px-3 py-2 text-sm font-medium text-brand-600'
                : '-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-gray-500 hover:text-gray-800'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search email…"
          className="max-w-xs"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {isLoading ? (
        <LoadingRows />
      ) : isError ? (
        <ErrorState message="Could not load users." onRetry={() => void refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="No users here" hint="Nothing matches this filter." />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH priority={3}>Role</TH>
                <TH priority={2}>Status</TH>
                <TH priority={4}>Registered</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {data.data.map((u) => {
                // Never offer moderation on yourself or on another superadmin.
                const protectedRow = u.id === me?.id || u.role === 'SUPERADMIN'
                const actions = protectedRow ? [] : ACTIONS_BY_STATUS[u.status]
                return (
                  <TR key={u.id}>
                    <TD className="font-medium text-gray-900">{u.email}</TD>
                    <TD priority={3}>
                      <Badge tone={u.role === 'SUPERADMIN' ? 'purple' : 'gray'}>{ROLE_LABELS[u.role]}</Badge>
                    </TD>
                    <TD priority={2}>
                      <UserStatusBadge status={u.status} />
                    </TD>
                    <TD priority={4}>{formatDate(u.createdAt)}</TD>
                    <TD className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {actions.map((action) => (
                          <Button
                            key={action}
                            size="sm"
                            variant={action === 'approve' || action === 'unblock' ? 'primary' : 'secondary'}
                            disabled={act.isPending}
                            onClick={() => setConfirming({ user: u, action })}
                          >
                            {ACTION_COPY[action].label}
                          </Button>
                        ))}
                        <Button size="sm" variant="ghost" onClick={() => setSessionsFor(u)}>
                          Sessions
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openActivity(u)}>
                          Activity
                        </Button>
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
          <Pagination
            currentPage={data.meta.currentPage}
            totalPages={data.meta.totalPages}
            totalItems={data.meta.totalItems}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={copy ? `${copy.label} user` : ''}
        message={confirming ? `Do you want to ${copy?.verb} ${confirming.user.email}?` : ''}
        confirmLabel={copy?.label}
        tone={copy?.danger ? 'danger' : 'primary'}
        pending={act.isPending}
        onConfirm={() =>
          confirming &&
          act.mutate({ id: confirming.user.id, action: confirming.action }, { onSettled: () => setConfirming(null) })
        }
        onCancel={() => setConfirming(null)}
      />

      <UserSessionsModal user={sessionsFor} onClose={() => setSessionsFor(null)} />

      <AuthActivityModal
        key={activityKey}
        open={activityFor !== undefined}
        onClose={() => setActivityFor(undefined)}
        userId={activityFor?.id}
        title={activityFor ? `Activity: ${activityFor.email}` : 'All activity'}
      />
    </div>
  )
}
