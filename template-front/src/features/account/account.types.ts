/** A signed-in browser/device. Same shape for /auth/sessions and /user/get-user-sessions/:userId. */
export interface Session {
  id: string
  deviceLabel: string | null
  ip: string | null
  createdAt: string
  lastActiveAt: string | null
  /** True for the session making this request (only meaningful on /auth/sessions). */
  isCurrent: boolean
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}
