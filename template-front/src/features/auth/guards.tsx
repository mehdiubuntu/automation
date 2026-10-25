import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { safeRedirect, type LoginLocationState } from './auth.nav'
import { useAuthStore } from './auth.store'
import { hasRole } from './auth.roles'
import type { UserRole } from './auth.types'

/**
 * Gate for authenticated routes. Redirects to /login, preserving the
 * attempted path so we can bounce back after login.
 */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

/**
 * Role gate. Renders children only if the signed-in user's role is one of
 * `roles`; otherwise sends them to the 403 page. (The server enforces the
 * same rule — this is the UX layer, not the security boundary.)
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: readonly UserRole[]
  children: React.ReactNode
}) {
  const role = useAuthStore((s) => s.user?.role)
  if (!hasRole(role, roles)) {
    return <Navigate to="/403" replace />
  }
  return <>{children}</>
}

/** Login/Register are pointless for a signed-in user: send them to where they were headed, or home. */
export function RedirectIfAuthenticated() {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()
  if (status === 'authenticated') {
    return <Navigate to={safeRedirect((location.state as LoginLocationState | null)?.from)} replace />
  }
  return <Outlet />
}
