import { api } from '@/lib/api/client'
import type { ChangePasswordInput, Session } from './account.types'

/** The list may arrive as a plain array or wrapped as { data: [...] }; always hand back an array. */
export function normalizeSessions(raw: Session[] | { data: Session[] } | null | undefined): Session[] {
  if (Array.isArray(raw)) return raw
  return raw?.data ?? []
}

/** Signed-in account actions. Paths are relative to VITE_API_BASE_URL. */
export const accountApi = {
  changePassword(input: ChangePasswordInput) {
    return api.post<unknown>('/auth/change-password', input)
  },
  async listSessions() {
    return normalizeSessions(await api.get<Session[] | { data: Session[] }>('/auth/sessions'))
  },
  revokeSession(id: Session['id']) {
    return api.delete<unknown>(`/auth/sessions/${id}`)
  },
  revokeOtherSessions() {
    return api.post<unknown>('/auth/sessions/revoke-others')
  },
  logoutAll() {
    return api.post<unknown>('/auth/logout-all')
  },
}
