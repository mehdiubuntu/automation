import type { UserRole } from './auth.types'

/** True when `role` is one of `roles`. The single place role checks are decided. */
export function hasRole(role: UserRole | undefined, roles: readonly UserRole[]): boolean {
  return role !== undefined && roles.includes(role)
}
