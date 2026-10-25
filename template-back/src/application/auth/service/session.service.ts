import { AuthEventService } from '@application/auth/service/auth-event.service'
import { AUTH_SETTINGS_TOKEN, type IAuthSettings } from '@domain/auth/contract/auth-settings.contract'
import { TOKEN_PROVIDER_TOKEN, type ITokenProvider } from '@domain/auth/contract/token-provider.contract'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { Session, SessionLifetimeRules } from '@domain/session/aggregate/session.aggregate'
import { SESSION_REPOSITORY_TOKEN, type ISessionRepository } from '@domain/session/repository/session.repository'
import { DeviceContext, parseDevice } from '@domain/session/service/device-info'
import { User } from '@domain/user/aggregate/user.aggregate'
import { Inject, Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

export interface IIssuedTokens {
  accessToken: string
  refreshToken: string
}

export interface ISessionView {
  id: string
  deviceLabel: string | null
  ip: string | null
  createdAt: Date
  lastActiveAt: Date
}

/** Session mechanics shared by login (start), refresh (rotate) and the management endpoints. */
@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessions: ISessionRepository,
    @Inject(TOKEN_PROVIDER_TOKEN)
    private readonly tokens: ITokenProvider,
    @Inject(AUTH_SETTINGS_TOKEN)
    private readonly settings: IAuthSettings,
    private readonly events: AuthEventService
  ) {}

  get rules(): SessionLifetimeRules {
    return { idleTimeoutSeconds: this.settings.sessionIdleTimeoutSeconds, absoluteLifetimeSeconds: this.settings.sessionAbsoluteLifetimeSeconds }
  }

  isLive(session: Session, now: Date): boolean {
    return session.isLive(now, this.rules)
  }

  /** One row per login. Evicts the oldest live sessions beyond MAX_SESSIONS_PER_USER. */
  async start(user: User, device: DeviceContext, now: Date): Promise<IIssuedTokens> {
    // The id travels inside the refresh token before the row exists, so it is made here (time-ordered UUIDv7, like the database default).
    const id = uuidv7()
    const refresh = this.tokens.generateRefreshToken({ sub: user.id!, sid: id })
    const access = this.tokens.generateAccessToken({ sub: user.id!, role: user.role!, sid: id })
    const info = parseDevice(device.userAgent)
    const lifetime = Math.min(refresh.expiresInSeconds, this.settings.sessionAbsoluteLifetimeSeconds)

    await this.sessions.insertOne(
      Session.create({
        id,
        userId: user.id!,
        tokenHash: this.tokens.hashToken(refresh.token),
        expiresAt: new Date(now.getTime() + lifetime * 1000),
        ip: device.ip,
        userAgent: device.userAgent?.slice(0, 255),
        deviceLabel: info.deviceName,
        now,
      })
    )
    await this.enforceLimit(user.id!, now, device)
    return { accessToken: access.token, refreshToken: refresh.token }
  }

  async listLive(userId: string, now: Date): Promise<Session[]> {
    return (await this.sessions.findOpenByUser(userId, now)).filter((session) => this.isLive(session, now))
  }

  toView(session: Session): ISessionView {
    return {
      id: session.id,
      deviceLabel: session.deviceLabel ?? null,
      ip: session.ip ?? null,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
    }
  }

  private async enforceLimit(userId: string, now: Date, device: DeviceContext): Promise<void> {
    const live = await this.listLive(userId, now) // oldest first; the session just created is last
    const excess = live.length - this.settings.maxSessionsPerUser
    if (excess <= 0) return
    const evicted = live.slice(0, excess)
    await this.sessions.revokeManyByIds(
      evicted.map((session) => session.id),
      now
    )
    await this.events.record({ type: AuthEventType.SESSION_REVOKED, userId, device })
  }
}
