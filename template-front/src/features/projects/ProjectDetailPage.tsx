import { Suspense } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { ErrorState, LoadingRows } from '@/components/feedback/States'
import { cn } from '@/lib/utils/cn'
import { useProject } from './project.hooks'
import { useProjectId } from './useProjectId'

/** Tabs of the project work area. Add a project-scoped feature = add an entry + a child route. */
const TABS = [{ to: 'items', label: 'Items' }]

/**
 * Host for everything that belongs to one project: header + tabs + the active
 * child route (`/projects/:id/items`, ...). Child pages read the id with
 * `useProjectId()` and pass it to their API calls.
 */
export default function ProjectDetailPage() {
  const projectId = useProjectId()
  const { data: project, isLoading, isError, refetch } = useProject(projectId ?? '')

  if (projectId === null) {
    return (
      <div className="p-8">
        <ErrorState message="Invalid project link." />
      </div>
    )
  }

  return (
    <div className="p-8">
      <Link to="/projects" className="mb-3 inline-block text-sm text-brand-600 hover:underline">
        ← All projects
      </Link>

      {isLoading ? (
        <LoadingRows rows={1} />
      ) : isError || !project ? (
        <ErrorState message="Could not load this project." onRetry={() => void refetch()} />
      ) : (
        <>
          <PageHeader
            title={project.name}
            subtitle={project.description ?? undefined}
            actions={
              <>
                <Badge>{project.code}</Badge>
                <Badge tone={project.isActive ? 'green' : 'gray'}>{project.isActive ? 'Active' : 'Inactive'}</Badge>
              </>
            }
          />

          <nav aria-label="Project sections" className="mb-6 flex gap-1 border-b border-gray-200">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  cn(
                    '-mb-px border-b-2 px-3 py-2 text-sm',
                    isActive
                      ? 'border-brand-600 font-medium text-brand-600'
                      : 'border-transparent text-gray-500 hover:text-gray-800',
                  )
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>

          {/* Own Suspense: a lazy tab suspends here, not up in PanelLayout (which would unmount this header). */}
          <Suspense fallback={<LoadingRows />}>
            <Outlet />
          </Suspense>
        </>
      )}
    </div>
  )
}
