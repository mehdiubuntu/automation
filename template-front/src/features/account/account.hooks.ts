import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/feedback/toast'
import { ApiError } from '@/lib/api/api-error'
import { useEndLocalSession } from '@/features/auth/auth.hooks'
import { accountApi } from './account.api'
import type { ChangePasswordInput, Session } from './account.types'

const KEY = 'account-sessions'

function onError(err: unknown) {
  toast.error(err instanceof ApiError ? err.message : 'Something went wrong')
}

export function useSessions() {
  return useQuery({ queryKey: [KEY], queryFn: () => accountApi.listSessions() })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => accountApi.changePassword(input),
    onSuccess: () => toast.success('Password changed'),
    onError,
  })
}

/** Revoke one session. Revoking the CURRENT one signs this browser out. */
export function useRevokeSession() {
  const qc = useQueryClient()
  const endLocalSession = useEndLocalSession()
  return useMutation({
    mutationFn: (session: Session) => accountApi.revokeSession(session.id),
    onSuccess: (_data, session) => {
      if (session.isCurrent) {
        toast.info('You were signed out')
        endLocalSession()
        return
      }
      toast.success('Session revoked')
      void qc.invalidateQueries({ queryKey: [KEY] })
    },
    onError,
  })
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => accountApi.revokeOtherSessions(),
    onSuccess: () => {
      toast.success('Signed out of other devices')
      void qc.invalidateQueries({ queryKey: [KEY] })
    },
    onError,
  })
}

export function useLogoutAll() {
  const endLocalSession = useEndLocalSession()
  return useMutation({
    mutationFn: () => accountApi.logoutAll(),
    onSuccess: () => {
      toast.info('Signed out everywhere')
      endLocalSession()
    },
    onError,
  })
}
