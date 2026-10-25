import { fakeId } from '@application/shared/testing/fake-id'
import { buildAuthWorld, createActiveUser, DEVICE, useFakeClock } from '@application/auth/testing/in-memory.fakes'
import { AuthUser } from '@domain/auth/type/auth-user.type'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'

const email = 'jane@example.test'
const password = 'Str0ng!Pass'

async function setup(overrides = {}) {
  const world = buildAuthWorld(overrides)
  const user = await createActiveUser(world)
  const login = () => world.login.login({ email, password }, DEVICE)
  const asUser = async (accessToken: string): Promise<AuthUser> => world.session.authenticateRequest(accessToken)
  return { world, user, login, asUser }
}

describe('SessionUseCase', () => {
  let clock: ReturnType<typeof useFakeClock>
  beforeEach(() => {
    clock = useFakeClock()
  })
  afterEach(() => clock.restore())

  describe('authenticateRequest', () => {
    it('resolves the principal from a live session, using role and status from the database', async () => {
      const { login, asUser, user } = await setup()
      const { accessToken } = await login()

      await expect(asUser(accessToken)).resolves.toMatchObject({ userId: user.id, email, role: UserRole.SPARTAN, status: UserStatus.ACTIVE })
    })

    it("rejects garbage, a revoked session and a token for someone else's session", async () => {
      const { world, login, asUser } = await setup()
      const { accessToken } = await login()

      await expect(asUser('garbage')).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION', status: 401 })
      await expect(world.session.authenticateRequest(undefined)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
      world.sessions.rows[0].userId = fakeId(999)
      await expect(asUser(accessToken)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
    })

    it('cuts a blocked user off at once because blocking revokes their sessions', async () => {
      const { world, user, login, asUser } = await setup()
      const { accessToken } = await login()
      const admin = { userId: fakeId(99), email: 'root@example.test', role: UserRole.SUPERADMIN, status: UserStatus.ACTIVE, sessionId: 's' }

      await world.userAdmin.blockUser(admin, user.id!, DEVICE)

      await expect(asUser(accessToken)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
    })

    it('rejects a user who is no longer ACTIVE even when the session row survived', async () => {
      const { world, user, login, asUser } = await setup()
      const { accessToken } = await login()
      await world.users.updateStatus(user.id!, UserStatus.BLOCKED)
      clock.advance(6000) // past the short user-state cache

      await expect(asUser(accessToken)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
    })

    it('enforces the idle timeout and the absolute lifetime', async () => {
      const { login, asUser } = await setup({ sessionIdleTimeoutSeconds: 600, sessionAbsoluteLifetimeSeconds: 3600 })
      const { accessToken } = await login()

      clock.advance(5 * 60 * 1000)
      await expect(asUser(accessToken)).resolves.toBeDefined() // touches lastActiveAt

      clock.advance(11 * 60 * 1000)
      await expect(asUser(accessToken)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
    })

    it('touches lastActiveAt at most once a minute', async () => {
      const { world, login, asUser } = await setup()
      const { accessToken } = await login()
      const touch = jest.spyOn(world.sessions, 'touchLastActive')

      await asUser(accessToken)
      expect(touch).not.toHaveBeenCalled()

      clock.advance(61 * 1000)
      await asUser(accessToken)
      await asUser(accessToken)
      expect(touch).toHaveBeenCalledTimes(1)
    })
  })

  describe('refresh rotation and reuse detection', () => {
    it('rotates the refresh token: the new pair works, the session stays the same row', async () => {
      const { world, login, user } = await setup()
      const { refreshToken } = await login()

      const rotated = await world.session.refresh(refreshToken, DEVICE)

      expect(rotated.refreshToken).toBeDefined()
      expect(rotated.refreshToken).not.toBe(refreshToken)
      expect(world.sessions.live(user.id!)).toHaveLength(1)
      await expect(world.session.refresh(rotated.refreshToken, DEVICE)).resolves.toBeDefined()
    })

    it('treats replay of an already-rotated token as theft: ALL the user sessions are revoked', async () => {
      const { world, login, user, asUser } = await setup()
      const other = await login()
      const { refreshToken } = await login()
      const rotated = await world.session.refresh(refreshToken, DEVICE)

      clock.advance(60 * 1000) // beyond the grace window
      await expect(world.session.refresh(refreshToken, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })

      expect(world.sessions.live(user.id!)).toHaveLength(0)
      await expect(world.session.refresh(rotated.refreshToken, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
      await expect(asUser(other.accessToken)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
      expect(world.authEvents.types()).toContain(AuthEventType.SESSION_REVOKED)
    })

    it('tolerates a parallel refresh inside the grace window without revoking anything', async () => {
      const { world, login, user } = await setup()
      const { refreshToken } = await login()
      const winner = await world.session.refresh(refreshToken, DEVICE)

      const loser = await world.session.refresh(refreshToken, DEVICE)

      expect(loser.accessToken).toBeTruthy()
      expect(loser.refreshToken).toBeUndefined()
      expect(world.sessions.live(user.id!)).toHaveLength(1)
      await expect(world.session.refresh(winner.refreshToken, DEVICE)).resolves.toBeDefined()
    })

    it('refuses a revoked session, a missing token and a blocked user (revoking their sessions)', async () => {
      const { world, login, user } = await setup()
      const { refreshToken } = await login()

      await expect(world.session.refresh(undefined, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
      await world.users.updateStatus(user.id!, UserStatus.BLOCKED)
      await expect(world.session.refresh(refreshToken, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
      expect(world.sessions.live(user.id!)).toHaveLength(0)
    })

    it('never extends a session past the absolute lifetime', async () => {
      const { world, login } = await setup({ sessionAbsoluteLifetimeSeconds: 3600 })
      const { refreshToken } = await login()
      const created = world.sessions.rows[0].createdAt.getTime()

      clock.advance(50 * 60 * 1000)
      await world.session.refresh(refreshToken, DEVICE)

      expect(world.sessions.rows[0].expiresAt.getTime()).toBeLessThanOrEqual(created + 3600 * 1000)
    })
  })

  describe('logout', () => {
    it('revokes only the current session and is a no-op without usable tokens', async () => {
      const { world, login, user, asUser } = await setup()
      const current = await login()
      const other = await login()

      await world.session.logout({ refreshToken: current.refreshToken }, DEVICE)
      await world.session.logout({}, DEVICE)

      await expect(asUser(current.accessToken)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
      await expect(asUser(other.accessToken)).resolves.toBeDefined()
      expect(world.sessions.live(user.id!)).toHaveLength(1)
      expect(world.authEvents.types()).toContain(AuthEventType.LOGOUT)
    })

    it('can log out with only the access token (refresh cookie already gone)', async () => {
      const { world, login, asUser } = await setup()
      const { accessToken } = await login()

      await world.session.logout({ accessToken }, DEVICE)

      await expect(asUser(accessToken)).rejects.toBeDefined()
    })

    it('logout-all revokes every session of the caller', async () => {
      const { world, login, user, asUser } = await setup()
      const first = await login()
      await login()

      const result = await world.session.logoutAll(await asUser(first.accessToken), DEVICE)

      expect(result).toEqual({ revoked: 2 })
      expect(world.sessions.live(user.id!)).toHaveLength(0)
    })
  })

  describe('session management', () => {
    it('lists only the caller own live sessions and flags the current one', async () => {
      const { world, login, asUser } = await setup()
      await createActiveUser(world, 'bob@example.test')
      await world.login.login({ email: 'bob@example.test', password }, DEVICE)
      await login()
      const second = await login()

      const sessions = await world.session.listOwnSessions(await asUser(second.accessToken))

      expect(sessions).toHaveLength(2)
      expect(sessions.filter((session) => session.isCurrent)).toHaveLength(1)
      expect(Object.keys(sessions[0]).sort()).toEqual(['createdAt', 'deviceLabel', 'id', 'ip', 'isCurrent', 'lastActiveAt'])
    })

    it('hides expired and revoked sessions from the list', async () => {
      const { world, login, asUser } = await setup()
      await login()
      const keep = await login()
      await world.sessions.revokeById(world.sessions.rows[0].id, new Date())

      expect(await world.session.listOwnSessions(await asUser(keep.accessToken))).toHaveLength(1)
    })

    it('revokes one own session, and answers 404 for a session of another user', async () => {
      const { world, login, asUser } = await setup()
      const mine = await login()
      const second = await login()
      await createActiveUser(world, 'bob@example.test')
      await world.login.login({ email: 'bob@example.test', password }, DEVICE)
      const bobSession = world.sessions.rows[world.sessions.rows.length - 1]
      const me = await asUser(mine.accessToken)

      await expect(world.session.revokeOwnSession(me, bobSession.id, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_SESSION_NOT_FOUND', status: 404 })
      await expect(world.session.revokeOwnSession(me, 'no-such-session', DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_SESSION_NOT_FOUND' })
      expect(bobSession.isRevoked()).toBe(false)

      await world.session.revokeOwnSession(me, world.sessions.rows[1].id, DEVICE)
      await expect(asUser(second.accessToken)).rejects.toBeDefined()
      await expect(world.session.revokeOwnSession(me, world.sessions.rows[1].id, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_SESSION_NOT_FOUND' })
    })

    it('revokes all the other sessions but not the current one', async () => {
      const { world, login, user, asUser } = await setup()
      const current = await login()
      await login()
      await login()

      const result = await world.session.revokeOtherSessions(await asUser(current.accessToken), DEVICE)

      expect(result).toEqual({ revoked: 2 })
      expect(world.sessions.live(user.id!)).toHaveLength(1)
      await expect(asUser(current.accessToken)).resolves.toBeDefined()
    })
  })
})
