import { UserRole, UserStatus } from '@domain/user/enum/user.enum'

/** The authenticated principal AuthGuard attaches to a request; role/status are re-read from the database, never trusted from the token. */
export interface AuthUser {
  userId: string
  email: string
  role: UserRole
  status: UserStatus
  sessionId: string
}

export interface AuthUserView {
  id: string
  email: string
  role: UserRole
  status: UserStatus
}

export function toAuthUserView(user: { userId: string; email: string; role: UserRole; status: UserStatus }): AuthUserView {
  return { id: user.userId, email: user.email, role: user.role, status: user.status }
}
