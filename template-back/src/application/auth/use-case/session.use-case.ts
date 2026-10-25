import { AuthErrors } from '@application/auth/error/auth.errors'
import { IRefreshResult } from '@application/auth/interface/auth-result.interface'
import { AuthEventService } from '@application/auth/service/auth-event.service'
import { ISessionView, SessionService } from '@application/auth/service/session.service'
import { AUTH_SETTINGS_TOKEN, type IAuthSettings } from '@domain/auth/contract/auth-settings.contract'
import { TOKEN_PROVIDER_TOKEN, type ITokenProvider } from '@domain/auth/contract/token-provider.contract'
import { AuthUser } from '@domain/auth/type/auth-user.type'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { SESSION_REPOSITORY_TOKEN, type ISessionRepository } from '@domain/session/repository/session.repository'
import { DeviceContext } from '@domain/session/service/device-info'
import { UserStatus } from '@domain/user/enum/user.enum'
import { USER_REPOSITORY_TOKEN, type IUserRepository } from '@domain/user/repository/user.repository'
import { Inject, Injectable } from '@nestjs/common'

/** lastActiveAt is display/idle metadata - refreshing it at most once a minute keeps hot endpoints write-free. */
const TOUCH_INTERVAL_MS = 60 * 1000
/** Short-lived cache of the account state AuthGuard re-checks on every request. */
const USER_CACHE_TTL_MS = 5 * 1000

interface CachedUser {
  email: string
  role: AuthUser['role']
  status: UserStatus
  expiresAt: number
}

@Injectable()
export class SessionUseCase {
  private readonly userCache = new Map<string, CachedUser>()

  constructor(
    @Inject(SESSION_REPOSITORY_TOKEN) private readonly sessions: ISessionRepository,
    @Inject(USER_REPOSITORY_TOKEN) private readonly users: IUserRepository,
    @Inject(TOKEN_PROVIDER_TOKEN) private readonly tokens: ITokenProvider,
    @Inject(AUTH_SETTINGS_TOKEN) private readonly settings: IAuthSettings,
    private readonly sessionService: SessionService,
    private readonly events: AuthEventService
  ) {}

  /**
   * Request-time authentication (AuthGuard): a valid access token, a live session row, and a user that is
   * still ACTIVE. Role and status come from the database, never from the token.
   */
  async authenticateRequest(accessToken: string | undefined): Promise<AuthUser> {
    const payload = accessToken ? this.tokens.verifyAccessToken(accessToken) : null
    if (!payload) throw AuthErrors.invalidSession()

    const now = new Date()
    const session = await this.sessions.findById(payload.sid)
    if (!session || session.userId !== payload.sub || !this.sessionService.isLive(session, now)) throw AuthErrors.invalidSession()

    const user = await this.loadUser(payload.sub, now)
    if (!user || user.status !== UserStatus.ACTIVE) throw AuthErrors.invalidSession()

    if (now.getTime() - session.lastActiveAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.sessions.touchLastActive(session.id, now)
    }
    return { userId: payload.sub, email: user.email, role: user.role, status: user.status, sessionId: session.id }
  }

  /**
   * Rotates the refresh token. Presenting a token that was already rotated (outside the short grace window
   * that tolerates parallel refreshes from one browser) means it leaked: every session of the user is revoked.
   */
  async refresh(refreshToken: string | undefined, device: DeviceContext): Promise<IRefreshResult> {
    const payload = refreshToken ? this.tokens.verifyRefreshToken(refreshToken) : null
    if (!refreshToken || !payload) throw AuthErrors.invalidSession()

    const now = new Date()
    const session = await this.sessions.findById(payload.sid)
    if (!session || session.userId !== payload.sub || !this.sessionService.isLive(session, now)) throw AuthErrors.invalidSession()

    const presentedHash = this.tokens.hashToken(refreshToken)
    const user = await this.users.findById(payload.sub)
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.sessions.revokeAllByUser(payload.sub, now)
      throw AuthErrors.invalidSession()
    }

    if (!this.tokens.hashesMatch(presentedHash, session.tokenHash)) {
      if (session.isWithinRotationGrace(presentedHash, now, this.settings.refreshGraceSeconds)) {
        return { accessToken: this.tokens.generateAccessToken({ sub: user.id!, role: user.role!, sid: session.id }).token }
      }
      await this.sessions.revokeAllByUser(payload.sub, now)
      await this.events.record({ type: AuthEventType.SESSION_REVOKED, userId: payload.sub, device })
      throw AuthErrors.invalidSession()
    }

    const next = this.tokens.generateRefreshToken({ sub: user.id!, sid: session.id })
    const expiresAt = session.nextExpiry(now, next.expiresInSeconds, this.settings.sessionAbsoluteLifetimeSeconds)
    if (!(await this.sessions.rotate(session.id, session.tokenHash, this.tokens.hashToken(next.token), expiresAt, now))) {
      // Lost a race against a parallel refresh: the winner's cookies are already on their way to the browser.
      return { accessToken: this.tokens.generateAccessToken({ sub: user.id!, role: user.role!, sid: session.id }).token }
    }
    return { accessToken: this.tokens.generateAccessToken({ sub: user.id!, role: user.role!, sid: session.id }).token, refreshToken: next.token }
  }

  /** Revokes the session the cookies belong to. Works with an expired access token; with no usable token it is a no-op. */
  async logout(tokens: { accessToken?: string; refreshToken?: string }, device: DeviceContext): Promise<void> {
    const sessionId =
      (tokens.refreshToken ? this.tokens.verifyRefreshToken(tokens.refreshToken)?.sid : undefined) ??
      (tokens.accessToken ? this.tokens.verifyAccessToken(tokens.accessToken)?.sid : undefined)
    if (!sessionId) return

    const session = await this.sessions.findById(sessionId)
    if (!session || session.isRevoked()) return
    await this.sessions.revokeById(session.id, new Date())
    await this.events.record({ type: AuthEventType.LOGOUT, userId: session.userId, device })
  }

  async listOwnSessions(user: AuthUser): Promise<Array<ISessionView & { isCurrent: boolean }>> {
    const live = await this.sessionService.listLive(user.userId, new Date())
    return live
      .map((session) => ({ ...this.sessionService.toView(session), isCurrent: session.id === user.sessionId }))
      .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
  }

  /** Only the caller's own sessions are reachable: anything else is "not found", never "forbidden". */
  async revokeOwnSession(user: AuthUser, sessionId: string, device: DeviceContext): Promise<void> {
    if (!(await this.sessions.revokeByIdAndUser(sessionId, user.userId, new Date()))) throw AuthErrors.sessionNotFound()
    await this.events.record({ type: AuthEventType.SESSION_REVOKED, userId: user.userId, device })
  }

  async revokeOtherSessions(user: AuthUser, device: DeviceContext): Promise<{ revoked: number }> {
    const revoked = await this.sessions.revokeOthersByUser(user.userId, user.sessionId, new Date())
    if (revoked > 0) await this.events.record({ type: AuthEventType.SESSION_REVOKED, userId: user.userId, device })
    return { revoked }
  }

  async logoutAll(user: AuthUser, device: DeviceContext): Promise<{ revoked: number }> {
    const revoked = await this.sessions.revokeAllByUser(user.userId, new Date())
    await this.events.record({ type: AuthEventType.LOGOUT, userId: user.userId, device })
    return { revoked }
  }

  private async loadUser(userId: string, now: Date): Promise<CachedUser | null> {
    const cached = this.userCache.get(userId)
    if (cached && cached.expiresAt > now.getTime()) return cached

    const user = await this.users.findById(userId)
    if (!user) {
      this.userCache.delete(userId)
      return null
    }
    if (this.userCache.size > 5000) this.userCache.clear()
    const entry: CachedUser = { email: user.email!, role: user.role!, status: user.status!, expiresAt: now.getTime() + USER_CACHE_TTL_MS }
    this.userCache.set(userId, entry)
    return entry
  }
}
