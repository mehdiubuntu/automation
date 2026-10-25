import { PageHeader } from '@/components/layout/PageHeader'
import { ChangePasswordCard } from './ChangePasswordCard'
import { SessionsCard } from './SessionsCard'

/** Self-service account security: change password + manage signed-in devices. */
export default function AccountPage() {
  return (
    <div className="p-8">
      <PageHeader title="Account" subtitle="Your password and signed-in devices." />
      <div className="max-w-3xl space-y-6">
        <ChangePasswordCard />
        <SessionsCard />
      </div>
    </div>
  )
}
