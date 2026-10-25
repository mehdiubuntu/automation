import { AccessTokenPayload, ITokenProvider, RefreshTokenPayload } from '@domain/auth/contract/token-provider.contract'
import { UserRole } from '@domain/user/enum/user.enum'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomUUID, timingSafeEqual } from 'crypto'

@Injectable()
export class JwtTokenProvider implements ITokenProvider {
  private readonly accessSecret: string
  private readonly refreshSecret: string
  private readonly accessExpiresSeconds: number
  private readonly refreshExpiresSeconds: number

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
    this.accessSecret = this.configService.get<string>('AuthConfig.jwtAccessSecret')!
    this.refreshSecret = this.configService.get<string>('AuthConfig.jwtRefreshSecret')!
    this.accessExpiresSeconds = this.configService.get<number>('AuthConfig.accessTokenExpiresSeconds')!
    this.refreshExpiresSeconds = this.configService.get<number>('AuthConfig.refreshTokenExpiresSeconds')!
  }

  generateAccessToken(payload: AccessTokenPayload): { token: string; expiresInSeconds: number } {
    const token = this.jwtService.sign({ sub: payload.sub, role: payload.role, sid: payload.sid }, { secret: this.accessSecret, expiresIn: this.accessExpiresSeconds })
    return { token, expiresInSeconds: this.accessExpiresSeconds }
  }

  generateRefreshToken(payload: RefreshTokenPayload): { token: string; expiresInSeconds: number } {
    const token = this.jwtService.sign(
      // jti: two refreshes within one second must not mint identical tokens - the stored hash is compared exactly.
      { sub: payload.sub, sid: payload.sid, jti: randomUUID() },
      { secret: this.refreshSecret, expiresIn: this.refreshExpiresSeconds }
    )
    return { token, expiresInSeconds: this.refreshExpiresSeconds }
  }

  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      const decoded = this.jwtService.verify<{ sub: string; role: UserRole; sid: string }>(token, { secret: this.accessSecret })
      return typeof decoded.sub === 'string' && typeof decoded.sid === 'string' ? { sub: decoded.sub, role: decoded.role, sid: decoded.sid } : null
    } catch {
      return null
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const decoded = this.jwtService.verify<{ sub: string; sid: string }>(token, { secret: this.refreshSecret })
      return typeof decoded.sub === 'string' && typeof decoded.sid === 'string' ? { sub: decoded.sub, sid: decoded.sid } : null
    } catch {
      return null
    }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  hashesMatch(a: string, b: string): boolean {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    return left.length === right.length && timingSafeEqual(left, right)
  }
}
