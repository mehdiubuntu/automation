import { api } from '@/lib/api/client'
import type { Paginated } from '@/lib/api/types'
import { normalizeSessions } from '@/features/account/account.api'
import type { Session } from '@/features/account/account.types'
import type { AuthEvent, GetAuthEventsQuery, GetUsersQuery, ManagedUser, UserAction } from './user.types'

export const usersApi = {
  list(query: GetUsersQuery) {
    return api.get<Paginated<ManagedUser>>('/user/get-users', { params: query })
  },
  /** approve | reject | block | unblock — POST /user/<action>-user/:id */
  act(id: string, action: UserAction) {
    return api.post<unknown>(`/user/${action}-user/${id}`)
  },
  async sessions(userId: string) {
    return normalizeSessions(await api.get<Session[] | { data: Session[] }>(`/user/get-user-sessions/${userId}`))
  },
  revokeSessions(userId: string) {
    return api.post<unknown>(`/user/revoke-user-sessions/${userId}`)
  },
  events(query: GetAuthEventsQuery) {
    return api.get<Paginated<AuthEvent>>('/user/get-auth-events', { params: query })
  },
}
