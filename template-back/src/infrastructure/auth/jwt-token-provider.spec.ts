import { fakeId } from '@application/shared/testing/fake-id'
import { UserRole } from '@domain/user/enum/user.enum'
import { JwtTokenProvider } from '@infrastructure/auth/jwt-token-provider'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

const values: Record<string, unknown> = {
  'AuthConfig.jwtAccessSecret': 'a'.repeat(40),
  'AuthConfig.jwtRefreshSecret': 'b'.repeat(40),
  'AuthConfig.accessTokenExpiresSeconds': 900,
  'AuthConfig.refreshTokenExpiresSeconds': 3600,
}
const SUB = fakeId(1)
const config = { get: (key: string) => values[key] } as unknown as ConfigService

describe('JwtTokenProvider', () => {
  const provider = new JwtTokenProvider(new JwtService({}), config)

  it('round-trips access and refresh claims and keeps the two secrets apart', () => {
    const access = provider.generateAccessToken({ sub: SUB, role: UserRole.SPARTAN, sid: 's-1' }).token
    const refresh = provider.generateRefreshToken({ sub: SUB, sid: 's-1' }).token

    expect(provider.verifyAccessToken(access)).toEqual({ sub: SUB, role: UserRole.SPARTAN, sid: 's-1' })
    expect(provider.verifyRefreshToken(refresh)).toEqual({ sub: SUB, sid: 's-1' })
    expect(provider.verifyAccessToken(refresh)).toBeNull()
    expect(provider.verifyRefreshToken(access)).toBeNull()
    expect(provider.verifyAccessToken('garbage')).toBeNull()
  })

  it('mints a different refresh token on every call', () => {
    const first = provider.generateRefreshToken({ sub: SUB, sid: 's-1' }).token
    const second = provider.generateRefreshToken({ sub: SUB, sid: 's-1' }).token
    expect(first).not.toBe(second)
  })

  it('hashes tokens one way and compares digests in constant time', () => {
    const hash = provider.hashToken('token')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain('token')
    expect(provider.hashesMatch(hash, provider.hashToken('token'))).toBe(true)
    expect(provider.hashesMatch(hash, provider.hashToken('other'))).toBe(false)
    expect(provider.hashesMatch(hash, 'short')).toBe(false)
  })
})
