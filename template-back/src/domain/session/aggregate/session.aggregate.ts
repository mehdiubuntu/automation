export interface SessionLifetimeRules {
  /** 0 or undefined disables the idle timeout. */
  idleTimeoutSeconds?: number
  absoluteLifetimeSeconds: number
}

export class Session {
  constructor(
    public id: string,
    public userId: string,
    public tokenHash: string,
    public expiresAt: Date,
    public ip: string | undefined,
    public userAgent: string | undefined,
    public deviceLabel: string | undefined,
    public createdAt: Date,
    public lastActiveAt: Date,
    public revokedAt: Date | null = null,
    /** Hash of the refresh token held just before the last rotation (reuse detection). */
    public rotatedFrom: string | null = null,
    public rotatedAt: Date | null = null
  ) {}

  static create(props: { id: string; userId: string; tokenHash: string; expiresAt: Date; ip?: string; userAgent?: string; deviceLabel?: string; now: Date }): Session {
    return new Session(props.id, props.userId, props.tokenHash, props.expiresAt, props.ip, props.userAgent, props.deviceLabel, props.now, props.now)
  }

  isRevoked(): boolean {
    return !!this.revokedAt
  }

  /** Alive = not revoked, inside its sliding expiry, inside the absolute cap, and not idle too long. */
  isLive(now: Date, rules: SessionLifetimeRules): boolean {
    if (this.isRevoked() || now.getTime() >= this.expiresAt.getTime()) return false
    if (now.getTime() >= this.createdAt.getTime() + rules.absoluteLifetimeSeconds * 1000) return false
    if (rules.idleTimeoutSeconds && now.getTime() - this.lastActiveAt.getTime() > rules.idleTimeoutSeconds * 1000) return false
    return true
  }

  /** The sliding expiry for the next refresh token, never past the absolute cap. */
  nextExpiry(now: Date, refreshLifetimeSeconds: number, absoluteLifetimeSeconds: number): Date {
    const sliding = now.getTime() + refreshLifetimeSeconds * 1000
    const cap = this.createdAt.getTime() + absoluteLifetimeSeconds * 1000
    return new Date(Math.min(sliding, cap))
  }

  /** True when `hash` is the token replaced moments ago (a parallel refresh, not a replay). */
  isWithinRotationGrace(hash: string, now: Date, graceSeconds: number): boolean {
    return !!this.rotatedFrom && !!this.rotatedAt && this.rotatedFrom === hash && now.getTime() - this.rotatedAt.getTime() <= graceSeconds * 1000
  }
}
