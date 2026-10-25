import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { useAuth } from '@/features/auth/useAuth'
import { ROLE_LABELS } from '@/features/auth/auth.types'

/**
 * Placeholder landing page. Replace the body with your product's own overview;
 * keep any data fetching in a `dashboard.hooks.ts` next to this file.
 */
export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="p-8">
      <PageHeader title="Dashboard" subtitle={user ? `Signed in as ${user.email} (${ROLE_LABELS[user.role]})` : undefined} />
      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-gray-900">Welcome</h2>
          <p className="mt-1 text-sm text-gray-500">This is a placeholder dashboard. Your work happens inside projects.</p>
          <Link to="/projects" className="mt-4 inline-block">
            <Button>Go to projects</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  )
}
