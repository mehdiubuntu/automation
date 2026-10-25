import { AuthWorld, buildAuthWorld, createActiveUser, DEVICE, useFakeClock } from '@application/auth/testing/in-memory.fakes'
import { AuthUser } from '@domain/auth/type/auth-user.type'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { OutboxEventType } from '@domain/outbox/enum/outbox.enum'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'

const email = 'jane@example.test'
const password = 'Str0ng!Pass'
const newPassword = 'N3w!Passw0rd'

async function loginTwice(world: AuthWorld) {
  const first = await world.login.login({ email, password }, DEVICE)
  const second = await world.login.login({ email, password }, DEVICE)
  const authenticate = (token: string) => world.session.authenticateRequest(token)
  return { first, second, authenticate }
}

describe('PasswordUseCase', () => {
  let clock: ReturnType<typeof useFakeClock>
  beforeEach(() => {
    clock = useFakeClock()
  })
  afterEach(() => clock.restore())

  describe('forgot + reset', () => {
    it('emails a reset code to an active user', async () => {
      const world = buildAuthWorld()
      await createActiveUser(world)
      world.outbox.rows.length = 0

      await world.password.forgotPassword({ email })

      expect(world.outbox.rows).toHaveLength(1)
      expect(world.outbox.rows[0].eventType).toBe(OutboxEventType.SEND_PASSWORD_RESET_OTP)
      expect(world.outbox.lastCode()).toMatch(/^\d{6}$/)
    })

    it('answers identically and sends nothing for unknown, unverified, blocked and super admin accounts', async () => {
      const world = buildAuthWorld()
      const user = await createActiveUser(world)
      world.outbox.rows.length = 0
      await world.users.updateStatus(user.id!, UserStatus.BLOCKED)
      await world.bootstrap.run()

      for (const target of ['nobody@example.test', email, world.settings.superAdminEmail]) {
        await expect(world.password.forgotPassword({ email: target })).resolves.toBeUndefined()
      }

      expect(world.outbox.rows).toHaveLength(0)
    })

    it('resets the password with the code, revokes EVERY session and queues a notice', async () => {
      const world = buildAuthWorld()
      const user = await createActiveUser(world)
      const { first, second, authenticate } = await loginTwice(world)
      await world.password.forgotPassword({ email })
      const code = world.outbox.lastCode()

      await world.password.resetPassword({ email, code, newPassword }, DEVICE)

      expect((await world.users.findByEmailWithPassword(email))!.password).toBe(`hashed(${newPassword})`)
      expect(world.sessions.live(user.id!)).toHaveLength(0)
      await expect(authenticate(first.accessToken)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
      await expect(authenticate(second.accessToken)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
      expect(world.outbox.rows[world.outbox.rows.length - 1].eventType).toBe(OutboxEventType.SEND_PASSWORD_RESET_COMPLETED_NOTICE)
      expect(world.authEvents.types()).toContain(AuthEventType.PASSWORD_RESET)
      await expect(world.login.login({ email, password: newPassword }, DEVICE)).resolves.toBeDefined()
    })

    it('clears a lockout when the password is reset', async () => {
      const world = buildAuthWorld()
      await createActiveUser(world)
      for (let i = 0; i < 5; i++) await world.login.login({ email, password: 'Wrong!Pass1' }, DEVICE).catch(() => undefined)
      await world.password.forgotPassword({ email })

      await world.password.resetPassword({ email, code: world.outbox.lastCode(), newPassword }, DEVICE)

      await expect(world.login.login({ email, password: newPassword }, DEVICE)).resolves.toBeDefined()
    })

    it('rejects a wrong code, a replayed code and a weak new password', async () => {
      const world = buildAuthWorld()
      await createActiveUser(world)
      await world.password.forgotPassword({ email })
      const code = world.outbox.lastCode()

      await expect(world.password.resetPassword({ email, code: '000000', newPassword }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' })
      await expect(world.password.resetPassword({ email, code, newPassword: 'weak' }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_WEAK_PASSWORD' })
      await world.password.resetPassword({ email, code, newPassword }, DEVICE)
      await expect(world.password.resetPassword({ email, code, newPassword: 'An0ther!Pass' }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' })
    })

    it('does not let a verification code reset a password, nor an unknown email probe', async () => {
      const world = buildAuthWorld()
      await createActiveUser(world)

      await expect(world.password.resetPassword({ email: 'nobody@example.test', code: '123456', newPassword }, DEVICE)).rejects.toMatchObject({
        errorCode: 'AUTH_INVALID_OTP',
        status: 400,
      })
    })
  })

  describe('changePassword', () => {
    const currentOf = async (world: AuthWorld, sessionIndex = 0): Promise<AuthUser> => {
      const user = (await world.users.findByEmail(email))!
      return { userId: user.id!, email, role: UserRole.SPARTAN, status: UserStatus.ACTIVE, sessionId: world.sessions.rows[sessionIndex].id }
    }

    it('revokes every OTHER session, keeps the current one and notifies by email', async () => {
      const world = buildAuthWorld()
      const user = await createActiveUser(world)
      const { first, second, authenticate } = await loginTwice(world)
      world.outbox.rows.length = 0

      await world.password.changePassword(await currentOf(world, 0), { currentPassword: password, newPassword }, DEVICE)

      await expect(authenticate(first.accessToken)).resolves.toMatchObject({ userId: user.id })
      await expect(authenticate(second.accessToken)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_SESSION' })
      expect(world.sessions.live(user.id!)).toHaveLength(1)
      expect(world.outbox.rows[0].eventType).toBe(OutboxEventType.SEND_PASSWORD_CHANGED_NOTICE)
      expect(world.authEvents.types()).toContain(AuthEventType.PASSWORD_CHANGED)
    })

    it('requires the correct current password', async () => {
      const world = buildAuthWorld()
      await createActiveUser(world)
      await world.login.login({ email, password }, DEVICE)

      await expect(world.password.changePassword(await currentOf(world), { currentPassword: 'Wrong!Pass1', newPassword }, DEVICE)).rejects.toMatchObject({
        errorCode: 'AUTH_INVALID_CURRENT_PASSWORD',
      })
    })

    it('rejects reusing the current password', async () => {
      const world = buildAuthWorld()
      await createActiveUser(world)
      await world.login.login({ email, password }, DEVICE)

      await expect(world.password.changePassword(await currentOf(world), { currentPassword: password, newPassword: password }, DEVICE)).rejects.toMatchObject({
        errorCode: 'AUTH_PASSWORD_REUSED',
      })
    })

    it('enforces the password policy', async () => {
      const world = buildAuthWorld()
      await createActiveUser(world)
      await world.login.login({ email, password }, DEVICE)

      await expect(world.password.changePassword(await currentOf(world), { currentPassword: password, newPassword: 'short' }, DEVICE)).rejects.toMatchObject({
        errorCode: 'AUTH_WEAK_PASSWORD',
      })
    })

    it('leaves the super admin password to the environment', async () => {
      const world = buildAuthWorld()
      await world.bootstrap.run()
      const admin = (await world.users.findByEmail(world.settings.superAdminEmail))!
      const current: AuthUser = { userId: admin.id!, email: admin.email!, role: UserRole.SUPERADMIN, status: UserStatus.ACTIVE, sessionId: 'sid' }

      await expect(world.password.changePassword(current, { currentPassword: world.settings.superAdminPassword, newPassword }, DEVICE)).rejects.toMatchObject({
        errorCode: 'AUTH_PASSWORD_MANAGED_BY_ENV',
      })
    })
  })
})
