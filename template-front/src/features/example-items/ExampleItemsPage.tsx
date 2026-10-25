import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Table, THead, TH, TR, TD, TBody } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState, ErrorState, LoadingRows } from '@/components/feedback/States'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { orDash } from '@/lib/utils/format'
import { useProjectId } from '@/features/projects/useProjectId'
import { ExampleItemFormModal } from './ExampleItemFormModal'
import { useDeleteExampleItem, useExampleItems } from './example-item.hooks'
import type { ExampleItem } from './example-item.types'

/**
 * Reference for a PROJECT-SCOPED list page, mounted at /projects/:id/items.
 * The project comes from the route (`useProjectId`), goes into the list query
 * (so each project has its own cache entry) and into the create body.
 * Any signed-in user can manage items; swap in `useAuth().hasRole([...])`
 * around the buttons if a feature needs to be role-restricted.
 */
export default function ExampleItemsPage() {
  const projectId = useProjectId()
  if (projectId === null) return <ErrorState message="Invalid project link." />
  return <ProjectItems projectId={projectId} />
}

function ProjectItems({ projectId }: { projectId: string }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ExampleItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  // Bumped on every open so the modal remounts with fresh form state.
  const [modalKey, setModalKey] = useState(0)
  const [deleting, setDeleting] = useState<ExampleItem | null>(null)

  const debouncedSearch = useDebounce(search)
  const query = useMemo(
    () => ({ projectId, page, limit: 10, order: 'DESC' as const, name: debouncedSearch || undefined }),
    [projectId, page, debouncedSearch],
  )

  const { data, isLoading, isError, refetch } = useExampleItems(query)
  const del = useDeleteExampleItem()

  const openForm = (item: ExampleItem | null) => {
    setEditing(item)
    setModalKey((k) => k + 1)
    setModalOpen(true)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search name…"
          className="max-w-xs"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <Button onClick={() => openForm(null)}>New item</Button>
      </div>

      {isLoading ? (
        <LoadingRows />
      ) : isError ? (
        <ErrorState message="Could not load items." onRetry={() => void refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="No items yet" hint="Create the first item for this project." />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH priority={2}>Description</TH>
                <TH priority={3}>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {data.data.map((item) => (
                <TR key={item.id}>
                  <TD className="font-medium text-gray-900">{item.name}</TD>
                  <TD priority={2}>{orDash(item.description)}</TD>
                  <TD priority={3}>
                    <Badge tone={item.isActive ? 'green' : 'gray'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openForm(item)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(item)}>
                        Delete
                      </Button>
                    </div>
                  </TD>
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

      <ExampleItemFormModal
        key={modalKey}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={projectId}
        item={editing ?? undefined}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete item"
        message={`Delete "${deleting?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        pending={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSettled: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
