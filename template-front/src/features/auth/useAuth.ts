import { useAuthStore } from './auth.store'
import { hasRole } from './auth.roles'
import type { UserRole } from './auth.types'

/**
 * The one hook components use to read "who am I". `user` is undefined until
 * the session is known (and while signed out); route guards make sure pages
 * behind `RequireAuth` always see a user.
 */
export function useAuth() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  return {
    status,
    user,
    isAuthenticated: status === 'authenticated',
    /** Convenience for UI toggles (buttons). Route access is enforced by <RequireRole>. */
    hasRole: (roles: readonly UserRole[]) => hasRole(user?.role, roles),
  }
}
