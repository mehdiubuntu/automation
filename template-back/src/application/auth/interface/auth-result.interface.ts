import { AuthUserView } from '@domain/auth/type/auth-user.type'
import { UserStatus } from '@domain/user/enum/user.enum'

/** Tokens leave the use-case only so the controller can put them in HttpOnly cookies; they never reach a response body. */
export interface ILoginResult {
  user: AuthUserView
  accessToken: string
  refreshToken: string
}

export interface IRefreshResult {
  accessToken: string
  /** Absent when this call lost a parallel-refresh race: the browser already holds the winner's refresh token. */
  refreshToken?: string
}

export interface IVerifyEmailResult {
  status: UserStatus
}
