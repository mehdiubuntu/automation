import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { USER_STATUS_LABELS, type UserStatus } from './user.types'

const tone: Record<UserStatus, BadgeTone> = {
  PENDING_VERIFICATION: 'gray',
  PENDING_APPROVAL: 'amber',
  ACTIVE: 'green',
  BLOCKED: 'red',
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge tone={tone[status]}>{USER_STATUS_LABELS[status]}</Badge>
}
