import { Logger } from '@nestjs/common'
import { fakeId } from '@application/shared/testing/fake-id'
import { IAuthSettings } from '@domain/auth/contract/auth-settings.contract'
import { IPasswordHasher } from '@domain/auth/contract/password-hasher.contract'
import { AccessTokenPayload, ITokenProvider, RefreshTokenPayload } from '@domain/auth/contract/token-provider.contract'
import { AuthEvent } from '@domain/auth-event/aggregate/auth-event.aggregate'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { IAuthEventRepository } from '@domain/auth-event/repository/auth-event.repository'
import { IOtpCodeProvider, OtpContext } from '@domain/otp/contract/otp-code.contract'
import { Otp } from '@domain/otp/aggregate/otp.aggregate'
import { OtpPurpose } from '@domain/otp/enum/otp.enum'
import { IOtpRepository } from '@domain/otp/repository/otp.repository'
import { OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { IOutboxRepository } from '@domain/outbox/repository/outbox.repository'
import { Session } from '@domain/session/aggregate/session.aggregate'
import { ISessionRepository } from '@domain/session/repository/session.repository'
import { UnitOfWork } from '@domain/shared/unit-of-work/unit-of-work.interface'
import { User } from '@domain/user/aggregate/user.aggregate'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'
import { IUserRepository } from '@domain/user/repository/user.repository'
import { AuthEventService } from '@application/auth/service/auth-event.service'
import { OtpService } from '@application/auth/service/otp.service'
import { SessionService } from '@application/auth/service/session.service'
import { EmailVerificationUseCase } from '@application/auth/use-case/email-verification.use-case'
import { LoginUseCase } from '@application/auth/use-case/login.use-case'
import { PasswordUseCase } from '@application/auth/use-case/password.use-case'
import { RegistrationUseCase } from '@application/auth/use-case/registration.use-case'
import { SessionUseCase } from '@application/auth/use-case/session.use-case'
import { UserAdminUseCase } from '@application/user/use-case/user-admin.use-case'
import { SuperAdminBootstrapUseCase } from '@application/user/use-case/super-admin-bootstrap.use-case'

/* ----------------------------------------------------------------------------------------------
 * In-memory stand-ins for the auth ports. Test support only (excluded from the build).
 * -------------------------------------------------------------------------------------------- */

export const TEST_SETTINGS: IAuthSettings = {
  requireApproval: true,
  superAdminEmail: 'root@example.test',
  superAdminPassword: 'Sup3r!Secret',
  maxFailedLogins: 5,
  lockoutMinutes: 15,
  otpTtlMinutes: 10,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  otpHourlyCap: 5,
  maxSessionsPerUser: 3,
  sessionIdleTimeoutSeconds: 0,
  sessionAbsoluteLifetimeSeconds: 30 * 24 * 3600,
  refreshGraceSeconds: 10,
  minResponseMs: 0,
}

export class InMemoryUserRepository implements IUserRepository {
  rows: User[] = []
  private nextId = 1

  private copy(user: User, withPassword: boolean): User {
    return User.restore(
      user.id!,
      user.email!,
      withPassword ? user.password : undefined,
      user.role!,
      user.status!,
      user.emailVerifiedAt ?? null,
      user.failedLoginAttempts ?? 0,
      user.lockedUntil ?? null,
      user.lastLoginAt ?? null,
      user.createdAt ?? new Date()
    )
  }

  private byId(id: string): User {
    return this.rows.find((row) => row.id === id)!
  }

  insertOne(entity: User): Promise<User> {
    if (this.rows.some((row) => row.email === entity.email)) return Promise.reject(new Error('duplicate key value violates unique constraint'))
    const saved = User.restore(
      fakeId(this.nextId++),
      entity.email!,
      entity.password,
      entity.role!,
      entity.status!,
      entity.emailVerifiedAt ?? null,
      0,
      null,
      null,
      new Date()
    )
    this.rows.push(saved)
    return Promise.resolve(this.copy(saved, false))
  }

  findById(id: string) {
    const row = this.rows.find((r) => r.id === id)
    return Promise.resolve(row ? this.copy(row, false) : null)
  }

  findByEmail(email: string) {
    const row = this.rows.find((r) => r.email === email)
    return Promise.resolve(row ? this.copy(row, false) : null)
  }

  findByEmailWithPassword(email: string) {
    const row = this.rows.find((r) => r.email === email)
    return Promise.resolve(row ? this.copy(row, true) : null)
  }

  findByIdWithPassword(id: string) {
    const row = this.rows.find((r) => r.id === id)
    return Promise.resolve(row ? this.copy(row, true) : null)
  }

  findUsers(query: { status?: UserStatus; search?: string }) {
    const data = this.rows
      .filter((row) => (!query.status || row.status === query.status) && (!query.search || row.email!.includes(query.search)))
      .map((row) => this.copy(row, false))
    return Promise.resolve({ data, meta: { itemsPerPage: 10, totalItems: data.length, currentPage: 1, totalPages: 1 } })
  }

  updateStatus(id: string, status: UserStatus) {
    this.byId(id).status = status
    return Promise.resolve()
  }

  markEmailVerified(id: string, status: UserStatus, at: Date) {
    Object.assign(this.byId(id), { status, emailVerifiedAt: at })
    return Promise.resolve()
  }

  updatePassword(id: string, passwordHash: string) {
    Object.assign(this.byId(id), { password: passwordHash, failedLoginAttempts: 0, lockedUntil: null })
    return Promise.resolve()
  }

  incrementFailedLogins(id: string) {
    const row = this.byId(id)
    row.failedLoginAttempts = (row.failedLoginAttempts ?? 0) + 1
    return Promise.resolve(row.failedLoginAttempts)
  }

  lock(id: string, until: Date) {
    Object.assign(this.byId(id), { lockedUntil: until, failedLoginAttempts: 0 })
    return Promise.resolve()
  }

  recordSuccessfulLogin(id: string, at: Date) {
    Object.assign(this.byId(id), { lastLoginAt: at, failedLoginAttempts: 0, lockedUntil: null })
    return Promise.resolve()
  }

  syncSuperAdmin(id: string, passwordHash: string | undefined, at: Date) {
    Object.assign(this.byId(id), { role: UserRole.SUPERADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: at, failedLoginAttempts: 0, lockedUntil: null })
    if (passwordHash) this.byId(id).password = passwordHash
    return Promise.resolve()
  }

  findSuperAdminsExcept(email: string) {
    return Promise.resolve(this.rows.filter((row) => row.role === UserRole.SUPERADMIN && row.email !== email).map((row) => this.copy(row, false)))
  }

  updateRole(id: string, role: UserRole) {
    this.byId(id).role = role
    return Promise.resolve()
  }
}

export class InMemoryOtpRepository implements IOtpRepository {
  rows: Otp[] = []
  private nextId = 1

  insertOne(entity: Otp) {
    const saved = Otp.restore(fakeId(this.nextId++), entity.userId!, entity.purpose!, entity.codeHash!, entity.expiresAt!, 0, null, new Date())
    this.rows.push(saved)
    return Promise.resolve(saved)
  }

  private forUser(userId: string, purpose: OtpPurpose) {
    return this.rows.filter((row) => row.userId === userId && row.purpose === purpose).sort((a, b) => b.id!.localeCompare(a.id!))
  }

  findLatestUnused(userId: string, purpose: OtpPurpose) {
    return Promise.resolve(this.forUser(userId, purpose).find((row) => !row.isUsed()) ?? null)
  }

  findLatest(userId: string, purpose: OtpPurpose) {
    return Promise.resolve(this.forUser(userId, purpose)[0] ?? null)
  }

  countCreatedSince(userId: string, purpose: OtpPurpose, since: Date) {
    return Promise.resolve(this.forUser(userId, purpose).filter((row) => row.createdAt! >= since).length)
  }

  invalidateUnused(userId: string, purpose: OtpPurpose, at: Date) {
    this.forUser(userId, purpose)
      .filter((row) => !row.isUsed())
      .forEach((row) => (row.usedAt = at))
    return Promise.resolve()
  }

  incrementAttempts(id: string) {
    const row = this.rows.find((r) => r.id === id)!
    row.attempts = (row.attempts ?? 0) + 1
    return Promise.resolve(row.attempts)
  }

  consumeIfUnused(id: string, at: Date) {
    const row = this.rows.find((r) => r.id === id)!
    if (row.isUsed()) return Promise.resolve(false)
    row.usedAt = at
    return Promise.resolve(true)
  }

  deleteExpired(now: Date) {
    const before = this.rows.length
    this.rows = this.rows.filter((row) => !row.isExpired(now))
    return Promise.resolve(before - this.rows.length)
  }
}

export class InMemorySessionRepository implements ISessionRepository {
  rows: Session[] = []

  insertOne(entity: Session) {
    this.rows.push(entity)
    return Promise.resolve(entity)
  }

  findById(id: string) {
    return Promise.resolve(this.rows.find((row) => row.id === id) ?? null)
  }

  findOpenByUser(userId: string, now: Date) {
    return Promise.resolve(
      this.rows.filter((row) => row.userId === userId && !row.isRevoked() && row.expiresAt > now).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    )
  }

  rotate(id: string, currentHash: string, nextHash: string, expiresAt: Date, now: Date) {
    const row = this.rows.find((r) => r.id === id)
    if (!row || row.tokenHash !== currentHash || row.isRevoked()) return Promise.resolve(false)
    Object.assign(row, { tokenHash: nextHash, rotatedFrom: currentHash, rotatedAt: now, expiresAt, lastActiveAt: now })
    return Promise.resolve(true)
  }

  touchLastActive(id: string, at: Date) {
    this.rows.find((row) => row.id === id)!.lastActiveAt = at
    return Promise.resolve()
  }

  revokeByIdAndUser(id: string, userId: string, at: Date) {
    const row = this.rows.find((r) => r.id === id && r.userId === userId && !r.isRevoked())
    if (row) row.revokedAt = at
    return Promise.resolve(!!row)
  }

  revokeById(id: string, at: Date) {
    const row = this.rows.find((r) => r.id === id && !r.isRevoked())
    if (row) row.revokedAt = at
    return Promise.resolve()
  }

  revokeManyByIds(ids: string[], at: Date) {
    this.rows.filter((row) => ids.includes(row.id) && !row.isRevoked()).forEach((row) => (row.revokedAt = at))
    return Promise.resolve()
  }

  revokeAllByUser(userId: string, at: Date) {
    const targets = this.rows.filter((row) => row.userId === userId && !row.isRevoked())
    targets.forEach((row) => (row.revokedAt = at))
    return Promise.resolve(targets.length)
  }

  revokeOthersByUser(userId: string, exceptSessionId: string, at: Date) {
    const targets = this.rows.filter((row) => row.userId === userId && row.id !== exceptSessionId && !row.isRevoked())
    targets.forEach((row) => (row.revokedAt = at))
    return Promise.resolve(targets.length)
  }

  deleteStale(now: Date, revokedBefore: Date) {
    const before = this.rows.length
    this.rows = this.rows.filter((row) => row.expiresAt >= now && !(row.revokedAt && row.revokedAt < revokedBefore))
    return Promise.resolve(before - this.rows.length)
  }

  live(userId: string) {
    return this.rows.filter((row) => row.userId === userId && !row.isRevoked())
  }
}

export class InMemoryAuthEventRepository implements IAuthEventRepository {
  rows: AuthEvent[] = []

  insertOne(entity: AuthEvent) {
    this.rows.push(entity)
    return Promise.resolve(entity)
  }

  findEvents(query: { userId?: string; type?: AuthEventType }) {
    const data = this.rows.filter((row) => (query.userId === undefined || row.userId === query.userId) && (!query.type || row.type === query.type))
    return Promise.resolve({ data, meta: { itemsPerPage: 10, totalItems: data.length, currentPage: 1, totalPages: 1 } })
  }

  deleteOlderThan() {
    return Promise.resolve(0)
  }

  types(): AuthEventType[] {
    return this.rows.map((row) => row.type!)
  }
}

export class InMemoryOutboxRepository {
  rows: OutboxMessage[] = []

  insertOne(entity: OutboxMessage) {
    this.rows.push(entity)
    return Promise.resolve(entity)
  }

  /** The OTP code of the newest queued email of the given kind - what the user would read in their inbox. */
  lastCode(): string {
    const payload = this.rows[this.rows.length - 1].payload as { code: string }
    return payload.code
  }
}

/** Cheap, transparent hasher: the "hash" is readable so tests can see what was stored. */
export class FakePasswordHasher implements IPasswordHasher {
  hashCalls = 0
  compareCalls = 0

  hash(plain: string) {
    this.hashCalls++
    return Promise.resolve(`hashed(${plain})`)
  }

  compare(plain: string, hash: string) {
    this.compareCalls++
    return Promise.resolve(hash === `hashed(${plain})`)
  }
}

/** Sequential codes starting at 100000, so a test can also supply a deliberately wrong one. */
export class FakeOtpCodeProvider implements IOtpCodeProvider {
  private next = 100000

  generate() {
    return String(this.next++)
  }

  hash(code: string, context: OtpContext) {
    return `otp(${context.purpose}:${context.userId}:${code})`
  }

  matches(code: string, context: OtpContext, storedHash: string) {
    return this.hash(code, context) === storedHash
  }
}

export class FakeTokenProvider implements ITokenProvider {
  private counter = 0

  generateAccessToken(payload: AccessTokenPayload) {
    return { token: `access|${payload.sub}|${payload.role}|${payload.sid}|${this.counter++}`, expiresInSeconds: 900 }
  }

  generateRefreshToken(payload: RefreshTokenPayload) {
    return { token: `refresh|${payload.sub}|${payload.sid}|${this.counter++}`, expiresInSeconds: 7 * 24 * 3600 }
  }

  verifyAccessToken(token: string): AccessTokenPayload | null {
    const [kind, sub, role, sid] = token.split('|')
    return kind === 'access' ? { sub, role: role as UserRole, sid } : null
  }

  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    const [kind, sub, sid] = token.split('|')
    return kind === 'refresh' ? { sub, sid } : null
  }

  hashToken(token: string) {
    return `sha(${token})`
  }

  hashesMatch(a: string, b: string) {
    return a === b
  }
}

export const passthroughUow: UnitOfWork = { execute: <T>(work: () => Promise<T>) => work() }

export const DEVICE = { ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36' }

/** Wires the real use-cases to the in-memory ports. */
export function buildAuthWorld(overrides: Partial<IAuthSettings> = {}) {
  Logger.overrideLogger(false)
  const settings: IAuthSettings = { ...TEST_SETTINGS, ...overrides }
  const users = new InMemoryUserRepository()
  const otps = new InMemoryOtpRepository()
  const sessions = new InMemorySessionRepository()
  const authEvents = new InMemoryAuthEventRepository()
  const outbox = new InMemoryOutboxRepository()
  const hasher = new FakePasswordHasher()
  const codes = new FakeOtpCodeProvider()
  const tokens = new FakeTokenProvider()
  const outboxPort = outbox as unknown as IOutboxRepository

  const events = new AuthEventService(authEvents)
  const otp = new OtpService(otps, codes, settings)
  const sessionService = new SessionService(sessions, tokens, settings, events)

  return {
    settings,
    users,
    otps,
    sessions,
    authEvents,
    outbox,
    hasher,
    tokens,
    registration: new RegistrationUseCase(users, hasher, outboxPort, passthroughUow, settings, otp, events),
    emailVerification: new EmailVerificationUseCase(users, outboxPort, passthroughUow, settings, otp, events),
    login: new LoginUseCase(users, hasher, passthroughUow, settings, sessionService, events),
    password: new PasswordUseCase(users, sessions, hasher, outboxPort, passthroughUow, settings, otp, events),
    session: new SessionUseCase(sessions, users, tokens, settings, sessionService, events),
    userAdmin: new UserAdminUseCase(users, sessions, authEvents, passthroughUow, sessionService, events),
    bootstrap: new SuperAdminBootstrapUseCase(users, sessions, hasher, settings),
    otpService: otp,
  }
}

export type AuthWorld = ReturnType<typeof buildAuthWorld>

/** Registers and verifies a user, returning the active account (approved when approval is required). */
export async function createActiveUser(world: AuthWorld, email = 'jane@example.test', password = 'Str0ng!Pass'): Promise<User> {
  await world.registration.register({ email, password }, DEVICE)
  await world.emailVerification.verifyEmail({ email, code: world.outbox.lastCode() }, DEVICE)
  const user = (await world.users.findByEmail(email))!
  if (user.status === UserStatus.PENDING_APPROVAL) await world.users.updateStatus(user.id!, UserStatus.ACTIVE)
  return (await world.users.findByEmail(email))!
}

/** Moves the system clock (Date only: timers stay real so the code under test never hangs). */
export function useFakeClock(startIso = '2026-01-01T00:00:00.000Z') {
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'hrtime', 'performance'],
    now: new Date(startIso),
  })
  return {
    advance: (ms: number) => jest.setSystemTime(new Date(Date.now() + ms)),
    restore: () => jest.useRealTimers(),
  }
}
