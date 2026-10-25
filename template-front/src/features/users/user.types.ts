import type { PaginationParams } from '@/lib/api/types'
import type { UserRole, UserStatus } from '@/features/auth/auth.types'

export { USER_STATUSES, USER_STATUS_LABELS } from '@/features/auth/auth.types'
export type { UserStatus } from '@/features/auth/auth.types'

/** A user as listed to a superadmin. */
export interface ManagedUser {
  id: string
  email: string
  role: UserRole
  status: UserStatus
  emailVerifiedAt: string | null
  createdAt: string
}

export interface GetUsersQuery extends PaginationParams {
  status?: UserStatus
  search?: string
}

/** Moderation transitions; each maps to POST /user/<action>-user/:id. */
export const USER_ACTIONS = ['approve', 'reject', 'block', 'unblock'] as const
export type UserAction = (typeof USER_ACTIONS)[number]

export const AUTH_EVENT_TYPES = [
  'REGISTERED',
  'EMAIL_VERIFIED',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOCKED',
  'LOGOUT',
  'SESSION_REVOKED',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET',
  'APPROVED',
  'REJECTED',
  'BLOCKED',
  'UNBLOCKED',
] as const
export type AuthEventType = (typeof AUTH_EVENT_TYPES)[number]

export interface AuthEvent {
  id: string
  userId: string | null
  type: AuthEventType
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface GetAuthEventsQuery extends PaginationParams {
  userId?: string
  type?: AuthEventType
}
