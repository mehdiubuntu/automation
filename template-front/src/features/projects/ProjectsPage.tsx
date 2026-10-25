import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownSelect } from '@/components/ui/DropdownSelect'
import { Input } from '@/components/ui/Input'
import { Table, THead, TH, TR, TD, TBody } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState, ErrorState, LoadingRows } from '@/components/feedback/States'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { orDash } from '@/lib/utils/format'
import { useAuth } from '@/features/auth/useAuth'
import { ProjectFormModal } from './ProjectFormModal'
import { useDeleteProject, useProjects } from './project.hooks'
import type { Project } from './project.types'

type ActiveFilter = '' | 'true' | 'false'

/**
 * Projects list for every signed-in user; SUPERADMIN additionally gets
 * create / edit / delete. The server enforces the same rule.
 */
export default function ProjectsPage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole(['SUPERADMIN'])

  const [search, setSearch] = useState('')
  const [active, setActive] = useState<ActiveFilter>('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Project | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  // Bumped on every open so the modal remounts with fresh form state.
  const [modalKey, setModalKey] = useState(0)
  const [deleting, setDeleting] = useState<Project | null>(null)

  const debouncedSearch = useDebounce(search)
  const query = useMemo(
    () => ({
      page,
      limit: 10,
      order: 'DESC' as const,
      search: debouncedSearch || undefined,
      isActive: active === '' ? undefined : active === 'true',
    }),
    [page, debouncedSearch, active],
  )

  const { data, isLoading, isError, refetch } = useProjects(query)
  const del = useDeleteProject()

  const openForm = (project: Project | null) => {
    setEditing(project)
    setModalKey((k) => k + 1)
    setModalOpen(true)
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Projects"
        subtitle="Pick a project to work inside it."
        actions={isAdmin && <Button onClick={() => openForm(null)}>New project</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search name or code…"
          className="max-w-xs"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <DropdownSelect
          placeholder="Status"
          clearLabel="All projects"
          value={active}
          onChange={(v) => {
            setActive(v as ActiveFilter)
            setPage(1)
          }}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
        />
      </div>

      {isLoading ? (
        <LoadingRows />
      ) : isError ? (
        <ErrorState message="Could not load projects." onRetry={() => void refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          title="No projects found"
          hint={isAdmin ? 'Create the first project to get started.' : 'Ask an administrator to create one.'}
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH priority={2}>Code</TH>
                <TH priority={3}>Description</TH>
                <TH priority={2}>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {data.data.map((p) => (
                <TR key={p.id}>
                  <TD className="font-medium text-gray-900">
                    <Link to={`/projects/${p.id}`} className="hover:text-brand-600 hover:underline">
                      {p.name}
                    </Link>
                  </TD>
                  <TD priority={2}>{p.code}</TD>
                  <TD priority={3}>{orDash(p.description)}</TD>
                  <TD priority={2}>
                    <Badge tone={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link to={`/projects/${p.id}`}>
                        <Button size="sm" variant="secondary">
                          Open
                        </Button>
                      </Link>
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => openForm(p)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}>
                            Delete
                          </Button>
                        </>
                      )}
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

      {isAdmin && (
        <ProjectFormModal
          key={modalKey}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          project={editing ?? undefined}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete project"
        message={`Delete "${deleting?.name ?? ''}"? Its items may be removed with it. This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        pending={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSettled: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
