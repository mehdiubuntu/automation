import { useEffect } from 'react'
import { setOnAuthLost } from '@/lib/api/client'
import { authApi } from './auth.api'
import { useAuthStore } from './auth.store'

/**
 * Runs once at app boot: asks the backend (via HttpOnly cookies) who the
 * session belongs to (GET /auth/me) and hydrates the auth store. Also wires
 * the API client's "auth lost" callback so a hard 401 flips the store to
 * unauthenticated (the router then redirects).
 */
export function useAuthBootstrap() {
  const status = useAuthStore((s) => s.status)
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated)
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated)

  useEffect(() => {
    setOnAuthLost(() => {
      // Only a session that WAS live counts as "lost" (revoked elsewhere,
      // refresh token expired). Concurrent 401s after the first are no-ops.
      const current = useAuthStore.getState().status
      if (current === 'authenticated') setUnauthenticated({ sessionLost: true })
      else if (current === 'unknown') setUnauthenticated()
    })
  }, [setUnauthenticated])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const user = await authApi.me()
        if (cancelled) return
        if (user) setAuthenticated(user)
        else setUnauthenticated()
      } catch {
        if (!cancelled) setUnauthenticated()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [setAuthenticated, setUnauthenticated])

  return { ready: status !== 'unknown' }
}
