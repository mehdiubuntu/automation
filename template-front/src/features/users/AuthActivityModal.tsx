import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { DropdownSelect } from '@/components/ui/DropdownSelect'
import { Pagination } from '@/components/ui/Pagination'
import { Table, THead, TH, TR, TD, TBody } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingRows } from '@/components/feedback/States'
import { formatDateTime, orDash } from '@/lib/utils/format'
import { useAuthEvents } from './user.hooks'
import { AUTH_EVENT_TYPES, type AuthEventType } from './user.types'

const labelOf = (t: string) => t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ')

/**
 * Auth activity log (superadmin). With `userId` it shows one user; without,
 * the whole system. Mounted only while open (the parent keys it per open) so
 * the filter and page state reset each time.
 */
export function AuthActivityModal({
  open,
  onClose,
  userId,
  title,
}: {
  open: boolean
  onClose: () => void
  userId?: string
  title: string
}) {
  const [type, setType] = useState<AuthEventType | ''>('')
  const [page, setPage] = useState(1)
  const query = useMemo(
    () => ({ userId, type: type || undefined, page, limit: 10, order: 'DESC' as const }),
    [userId, type, page],
  )
  const { data, isLoading, isError, refetch } = useAuthEvents(query, open)

  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-3xl">
      <div className="mb-3">
        <DropdownSelect
          placeholder="Event type"
          clearLabel="All events"
          value={type}
          onChange={(v) => {
            setType(v as AuthEventType | '')
            setPage(1)
          }}
          options={AUTH_EVENT_TYPES.map((t) => ({ value: t, label: labelOf(t) }))}
        />
      </div>

      {isLoading ? (
        <LoadingRows rows={4} />
      ) : isError ? (
        <ErrorState message="Could not load activity." onRetry={() => void refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="No activity" />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Event</TH>
                {userId === undefined && <TH priority={2}>User</TH>}
                <TH priority={2}>IP</TH>
                <TH>When</TH>
              </TR>
            </THead>
            <TBody>
              {data.data.map((ev) => (
                <TR key={ev.id}>
                  <TD className="font-medium text-gray-900">{labelOf(ev.type)}</TD>
                  {userId === undefined && <TD priority={2}>#{ev.userId}</TD>}
                  <TD priority={2}>{orDash(ev.ip)}</TD>
                  <TD>{formatDateTime(ev.createdAt)}</TD>
                </TR>
              ))}
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
    </Modal>
  )
}
