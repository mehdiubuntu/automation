import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/feedback/toast'
import { ApiError } from '@/lib/api/api-error'
import { usersApi } from './user.api'
import type { GetAuthEventsQuery, GetUsersQuery, UserAction } from './user.types'

const KEY = 'users'
const SESSIONS_KEY = 'user-sessions'
const EVENTS_KEY = 'auth-events'

function onError(err: unknown) {
  toast.error(err instanceof ApiError ? err.message : 'Something went wrong')
}

export function useUsers(query: GetUsersQuery) {
  return useQuery({
    queryKey: [KEY, query],
    queryFn: () => usersApi.list(query),
    placeholderData: keepPreviousData,
  })
}

const ACTION_DONE: Record<UserAction, string> = {
  approve: 'User approved',
  reject: 'User rejected',
  block: 'User blocked',
  unblock: 'User unblocked',
}

/** One mutation for every moderation transition (approve / reject / block / unblock). */
export function useUserAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: UserAction }) => usersApi.act(id, action),
    onSuccess: (_data, { action }) => {
      toast.success(ACTION_DONE[action])
      void qc.invalidateQueries({ queryKey: [KEY] })
      void qc.invalidateQueries({ queryKey: [EVENTS_KEY] })
    },
    onError,
  })
}

export function useUserSessions(userId: string | null) {
  return useQuery({
    queryKey: [SESSIONS_KEY, userId],
    queryFn: () => usersApi.sessions(userId as string),
    enabled: userId !== null,
  })
}

export function useRevokeUserSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => usersApi.revokeSessions(userId),
    onSuccess: () => {
      toast.success('Sessions revoked')
      void qc.invalidateQueries({ queryKey: [SESSIONS_KEY] })
      void qc.invalidateQueries({ queryKey: [EVENTS_KEY] })
    },
    onError,
  })
}

export function useAuthEvents(query: GetAuthEventsQuery, enabled = true) {
  return useQuery({
    queryKey: [EVENTS_KEY, query],
    queryFn: () => usersApi.events(query),
    enabled,
    placeholderData: keepPreviousData,
  })
}
