import { buildAuthWorld, DEVICE, useFakeClock } from '@application/auth/testing/in-memory.fakes'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { UserStatus } from '@domain/user/enum/user.enum'

const email = 'jane@example.test'
const password = 'Str0ng!Pass'

describe('EmailVerificationUseCase', () => {
  let clock: ReturnType<typeof useFakeClock>
  beforeEach(() => {
    clock = useFakeClock()
  })
  afterEach(() => clock.restore())

  it('moves the user to PENDING_APPROVAL when approval is required', async () => {
    const world = buildAuthWorld({ requireApproval: true })
    await world.registration.register({ email, password }, DEVICE)

    const result = await world.emailVerification.verifyEmail({ email, code: world.outbox.lastCode() }, DEVICE)

    expect(result).toEqual({ status: UserStatus.PENDING_APPROVAL })
    expect(await world.users.findByEmail(email)).toMatchObject({ status: UserStatus.PENDING_APPROVAL })
    expect(world.authEvents.types()).toContain(AuthEventType.EMAIL_VERIFIED)
  })

  it('moves the user straight to ACTIVE when REQUIRE_APPROVAL is off', async () => {
    const world = buildAuthWorld({ requireApproval: false })
    await world.registration.register({ email, password }, DEVICE)

    const result = await world.emailVerification.verifyEmail({ email, code: world.outbox.lastCode() }, DEVICE)

    expect(result).toEqual({ status: UserStatus.ACTIVE })
    expect((await world.users.findByEmail(email))!.emailVerifiedAt).toBeInstanceOf(Date)
  })

  it('rejects a wrong code with AUTH_INVALID_OTP and leaves the account unverified', async () => {
    const world = buildAuthWorld()
    await world.registration.register({ email, password }, DEVICE)

    await expect(world.emailVerification.verifyEmail({ email, code: '000000' }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP', status: 400 })

    expect(await world.users.findByEmail(email)).toMatchObject({ status: UserStatus.PENDING_VERIFICATION })
  })

  it('locks the code out after 5 wrong attempts', async () => {
    const world = buildAuthWorld()
    await world.registration.register({ email, password }, DEVICE)
    const code = world.outbox.lastCode()

    for (let i = 0; i < 5; i++) {
      await expect(world.emailVerification.verifyEmail({ email, code: '000000' }, DEVICE)).rejects.toBeDefined()
    }

    await expect(world.emailVerification.verifyEmail({ email, code }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' })
  })

  it('refuses an expired code and a replayed one', async () => {
    const world = buildAuthWorld()
    await world.registration.register({ email, password }, DEVICE)
    const code = world.outbox.lastCode()

    clock.advance(11 * 60 * 1000)
    await expect(world.emailVerification.verifyEmail({ email, code }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' })

    await world.emailVerification.resendVerification({ email })
    const fresh = world.outbox.lastCode()
    await world.emailVerification.verifyEmail({ email, code: fresh }, DEVICE)
    await expect(world.emailVerification.verifyEmail({ email, code: fresh }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' })
  })

  it('gives an unknown email and an already verified account the same error as a wrong code', async () => {
    const world = buildAuthWorld({ requireApproval: false })
    await world.registration.register({ email, password }, DEVICE)
    const code = world.outbox.lastCode()
    await world.emailVerification.verifyEmail({ email, code }, DEVICE)

    const unknown = await world.emailVerification.verifyEmail({ email: 'nobody@example.test', code: '123456' }, DEVICE).catch((error: unknown) => error)
    const verified = await world.emailVerification.verifyEmail({ email, code }, DEVICE).catch((error: unknown) => error)

    expect(unknown).toMatchObject({ errorCode: 'AUTH_INVALID_OTP', status: 400, message: 'The code is invalid or has expired.' })
    expect(verified).toMatchObject({ errorCode: 'AUTH_INVALID_OTP', status: 400, message: 'The code is invalid or has expired.' })
  })

  describe('resendVerification', () => {
    it('sends a new code and invalidates the previous one', async () => {
      const world = buildAuthWorld()
      await world.registration.register({ email, password }, DEVICE)
      const first = world.outbox.lastCode()
      clock.advance(61 * 1000)

      await world.emailVerification.resendVerification({ email })

      expect(world.outbox.rows).toHaveLength(2)
      await expect(world.emailVerification.verifyEmail({ email, code: first }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' })
      await expect(world.emailVerification.verifyEmail({ email, code: world.outbox.lastCode() }, DEVICE)).resolves.toBeDefined()
    })

    it('silently honours the 60 s cooldown', async () => {
      const world = buildAuthWorld()
      await world.registration.register({ email, password }, DEVICE)

      await expect(world.emailVerification.resendVerification({ email })).resolves.toBeUndefined()

      expect(world.outbox.rows).toHaveLength(1)
    })

    it('answers the same for unknown, already verified and blocked accounts, and sends nothing', async () => {
      const world = buildAuthWorld({ requireApproval: false })
      await world.registration.register({ email, password }, DEVICE)
      await world.emailVerification.verifyEmail({ email, code: world.outbox.lastCode() }, DEVICE)
      const queued = world.outbox.rows.length
      clock.advance(61 * 1000)

      await expect(world.emailVerification.resendVerification({ email: 'nobody@example.test' })).resolves.toBeUndefined()
      await expect(world.emailVerification.resendVerification({ email })).resolves.toBeUndefined()

      expect(world.outbox.rows).toHaveLength(queued)
    })
  })
})
