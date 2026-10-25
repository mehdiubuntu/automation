import { buildAuthWorld, createActiveUser, DEVICE, useFakeClock } from '@application/auth/testing/in-memory.fakes'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'

const email = 'jane@example.test'
const password = 'Str0ng!Pass'

describe('LoginUseCase', () => {
  let clock: ReturnType<typeof useFakeClock>
  beforeEach(() => {
    clock = useFakeClock()
  })
  afterEach(() => clock.restore())

  it('logs an active user in: returns the user, never a password, and opens a session', async () => {
    const world = buildAuthWorld()
    const user = await createActiveUser(world)

    const result = await world.login.login({ email, password }, DEVICE)

    expect(result.user).toEqual({ id: user.id, email, role: UserRole.SPARTAN, status: UserStatus.ACTIVE })
    expect(JSON.stringify(result.user)).not.toContain('hashed(')
    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    expect(world.sessions.live(user.id!)).toHaveLength(1)
    expect(world.sessions.live(user.id!)[0]).toMatchObject({ deviceLabel: 'Chrome on Windows', ip: DEVICE.ip })
    expect(world.authEvents.types()).toContain(AuthEventType.LOGIN_SUCCESS)
  })

  it('gives unknown email and wrong password the identical error', async () => {
    const world = buildAuthWorld()
    await createActiveUser(world)

    const unknown = await world.login.login({ email: 'nobody@example.test', password }, DEVICE).catch((error: unknown) => error)
    const wrong = await world.login.login({ email, password: 'Wrong!Pass1' }, DEVICE).catch((error: unknown) => error)

    for (const error of [unknown, wrong]) {
      expect(error).toMatchObject({ errorCode: 'AUTH_INVALID_CREDENTIALS', status: 401, message: 'Invalid email or password.' })
    }
  })

  it('spends a bcrypt comparison on an unknown email (timing equalisation)', async () => {
    const world = buildAuthWorld()
    await createActiveUser(world)
    const before = world.hasher.compareCalls

    await expect(world.login.login({ email: 'nobody@example.test', password }, DEVICE)).rejects.toBeDefined()

    expect(world.hasher.compareCalls).toBe(before + 1)
  })

  it('normalises the email on login', async () => {
    const world = buildAuthWorld()
    await createActiveUser(world)

    await expect(world.login.login({ email: '  JANE@Example.TEST ', password }, DEVICE)).resolves.toBeDefined()
  })

  describe('status gating (only after the password was verified)', () => {
    it.each([
      [UserStatus.PENDING_VERIFICATION, 'AUTH_EMAIL_NOT_VERIFIED'],
      [UserStatus.PENDING_APPROVAL, 'AUTH_PENDING_APPROVAL'],
      [UserStatus.BLOCKED, 'AUTH_BLOCKED'],
    ])('%s -> %s with the right password', async (status, errorCode) => {
      const world = buildAuthWorld()
      const user = await createActiveUser(world)
      await world.users.updateStatus(user.id!, status)

      await expect(world.login.login({ email, password }, DEVICE)).rejects.toMatchObject({ errorCode, status: 403 })
      expect(world.sessions.rows).toHaveLength(0)
    })

    it('does not reveal the status to a wrong password', async () => {
      const world = buildAuthWorld()
      const user = await createActiveUser(world)
      await world.users.updateStatus(user.id!, UserStatus.BLOCKED)

      await expect(world.login.login({ email, password: 'Wrong!Pass1' }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_CREDENTIALS' })
    })
  })

  describe('lockout', () => {
    it('locks the account after 5 failures; only the right password then learns about the lock', async () => {
      const world = buildAuthWorld()
      await createActiveUser(world)

      for (let i = 0; i < 5; i++) {
        await expect(world.login.login({ email, password: 'Wrong!Pass1' }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_CREDENTIALS' })
      }

      await expect(world.login.login({ email, password: 'Wrong!Pass1' }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_CREDENTIALS' })
      await expect(world.login.login({ email, password }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_LOCKED', status: 403 })
      expect(world.authEvents.types()).toContain(AuthEventType.LOCKED)
      expect(world.sessions.rows).toHaveLength(0)
    })

    it('does not extend the lock while it is active', async () => {
      const world = buildAuthWorld()
      const user = await createActiveUser(world)
      for (let i = 0; i < 5; i++) await world.login.login({ email, password: 'Wrong!Pass1' }, DEVICE).catch(() => undefined)
      const lockedUntil = (await world.users.findByEmail(email))!.lockedUntil

      clock.advance(60 * 1000)
      await world.login.login({ email, password: 'Wrong!Pass1' }, DEVICE).catch(() => undefined)

      expect((await world.users.findByEmail(email))!.lockedUntil).toEqual(lockedUntil)
      expect(user.id).toBeDefined()
    })

    it('unlocks after 15 minutes', async () => {
      const world = buildAuthWorld()
      await createActiveUser(world)
      for (let i = 0; i < 5; i++) await world.login.login({ email, password: 'Wrong!Pass1' }, DEVICE).catch(() => undefined)

      clock.advance(15 * 60 * 1000 + 1000)

      await expect(world.login.login({ email, password }, DEVICE)).resolves.toBeDefined()
    })

    it('resets the failure counter on a successful login', async () => {
      const world = buildAuthWorld()
      await createActiveUser(world)
      for (let i = 0; i < 4; i++) await world.login.login({ email, password: 'Wrong!Pass1' }, DEVICE).catch(() => undefined)

      await world.login.login({ email, password }, DEVICE)
      await world.login.login({ email, password: 'Wrong!Pass1' }, DEVICE).catch(() => undefined)

      expect((await world.users.findByEmail(email))!.failedLoginAttempts).toBe(1)
      expect((await world.users.findByEmail(email))!.lockedUntil).toBeNull()
    })

    it('records failed logins in the audit trail without any secret', async () => {
      const world = buildAuthWorld()
      await createActiveUser(world)

      await world.login.login({ email, password: 'Wrong!Pass1' }, DEVICE).catch(() => undefined)
      await world.login.login({ email: 'nobody@example.test', password: 'Wrong!Pass1' }, DEVICE).catch(() => undefined)

      const failed = world.authEvents.rows.filter((row) => row.type === AuthEventType.LOGIN_FAILED)
      expect(failed).toHaveLength(2)
      expect(failed[1].userId).toBeNull()
      expect(JSON.stringify(failed)).not.toMatch(/Wrong!Pass1|nobody@/)
    })
  })

  describe('concurrent sessions', () => {
    it('gives every login its own session', async () => {
      const world = buildAuthWorld()
      const user = await createActiveUser(world)

      await world.login.login({ email, password }, DEVICE)
      await world.login.login({ email, password }, { ...DEVICE, userAgent: 'Mozilla/5.0 (iPhone) Safari/604.1' })

      expect(world.sessions.live(user.id!)).toHaveLength(2)
    })

    it('evicts the oldest session beyond MAX_SESSIONS_PER_USER', async () => {
      const world = buildAuthWorld({ maxSessionsPerUser: 3 })
      const user = await createActiveUser(world)

      for (let i = 0; i < 4; i++) {
        await world.login.login({ email, password }, DEVICE)
        clock.advance(1000)
      }

      const live = world.sessions.live(user.id!)
      expect(live).toHaveLength(3)
      const [oldest] = world.sessions.rows
      expect(oldest.isRevoked()).toBe(true)
      expect(live).not.toContain(oldest)
    })
  })
})
