import { create } from 'zustand'
import { queryClient } from '@/lib/api/query-client'
import type { AuthUser } from './auth.types'

type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated'

interface AuthState {
  status: AuthStatus
  /** Present only while `status === 'authenticated'`. Never holds tokens. */
  user?: AuthUser
  /** True when a live session was lost involuntarily (revoked elsewhere, expired). Login shows a notice. */
  sessionLost: boolean

  setAuthenticated: (user: AuthUser) => void
  setUnauthenticated: (opts?: { sessionLost?: boolean }) => void
  clearSessionLost: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  sessionLost: false,

  setAuthenticated: (user) => set({ status: 'authenticated', user, sessionLost: false }),

  setUnauthenticated: (opts) => {
    set({ status: 'unauthenticated', user: undefined, sessionLost: opts?.sessionLost ?? false })
    // The session is gone — so is every server-derived cache entry. Without this,
    // a re-login within staleTime would serve the previous session's data.
    queryClient.clear()
  },

  clearSessionLost: () => set({ sessionLost: false }),
}))
