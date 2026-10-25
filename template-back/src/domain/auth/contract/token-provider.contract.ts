import { UserRole } from '@domain/user/enum/user.enum'

export const TOKEN_PROVIDER_TOKEN = Symbol('TOKEN_PROVIDER_TOKEN')

export interface AccessTokenPayload {
  sub: string
  role: UserRole
  sid: string
}

export interface RefreshTokenPayload {
  sub: string
  sid: string
}

export interface ITokenProvider {
  generateAccessToken(payload: AccessTokenPayload): { token: string; expiresInSeconds: number }
  generateRefreshToken(payload: RefreshTokenPayload): { token: string; expiresInSeconds: number }
  verifyAccessToken(token: string): AccessTokenPayload | null
  verifyRefreshToken(token: string): RefreshTokenPayload | null
  /** Stable one-way hash used to persist/lookup refresh tokens server-side. */
  hashToken(token: string): string
  /** Constant-time comparison of two hex digests. */
  hashesMatch(a: string, b: string): boolean
}
