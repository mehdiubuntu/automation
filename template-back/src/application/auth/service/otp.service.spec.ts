import { fakeId } from '@application/shared/testing/fake-id'
import { buildAuthWorld, useFakeClock } from '@application/auth/testing/in-memory.fakes'
import { OtpPurpose } from '@domain/otp/enum/otp.enum'

const PURPOSE = OtpPurpose.EMAIL_VERIFICATION
const USER_ID = fakeId(1)

describe('OtpService', () => {
  let clock: ReturnType<typeof useFakeClock>
  let world: ReturnType<typeof buildAuthWorld>

  beforeEach(() => {
    clock = useFakeClock()
    world = buildAuthWorld()
  })
  afterEach(() => clock.restore())

  it('issues a 6-digit code and stores only its hash', async () => {
    const code = await world.otpService.issue(USER_ID, PURPOSE, new Date())

    expect(code).toMatch(/^\d{6}$/)
    expect(world.otps.rows).toHaveLength(1)
    expect(world.otps.rows[0].codeHash).not.toBe(code)
  })

  it('accepts the right code once and refuses to reuse it (single use)', async () => {
    const code = (await world.otpService.issue(USER_ID, PURPOSE, new Date()))!

    const otp = await world.otpService.check(USER_ID, PURPOSE, code, new Date())
    expect(await world.otpService.consume(otp.id!, new Date())).toBe(true)

    await expect(world.otpService.check(USER_ID, PURPOSE, code, new Date())).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP', status: 400 })
    expect(await world.otpService.consume(otp.id!, new Date())).toBe(false)
  })

  it('expires after OTP_TTL_MINUTES', async () => {
    const code = (await world.otpService.issue(USER_ID, PURPOSE, new Date()))!

    clock.advance(10 * 60 * 1000 - 1000)
    await expect(world.otpService.check(USER_ID, PURPOSE, code, new Date())).resolves.toBeDefined()

    clock.advance(2000)
    await expect(world.otpService.check(USER_ID, PURPOSE, code, new Date())).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' })
  })

  it('kills the code after 5 wrong attempts, even if the right one is then supplied', async () => {
    const code = (await world.otpService.issue(USER_ID, PURPOSE, new Date()))!

    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(world.otpService.check(USER_ID, PURPOSE, '000000', new Date())).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' })
    }

    await expect(world.otpService.check(USER_ID, PURPOSE, code, new Date())).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' })
  })

  it('still accepts the right code on the fifth attempt', async () => {
    const code = (await world.otpService.issue(USER_ID, PURPOSE, new Date()))!

    for (let attempt = 0; attempt < 4; attempt++) {
      await expect(world.otpService.check(USER_ID, PURPOSE, '000000', new Date())).rejects.toBeDefined()
    }

    await expect(world.otpService.check(USER_ID, PURPOSE, code, new Date())).resolves.toBeDefined()
  })

  it('invalidates the previous code when a new one is issued', async () => {
    const first = (await world.otpService.issue(USER_ID, PURPOSE, new Date()))!
    clock.advance(61 * 1000)
    const second = (await world.otpService.issue(USER_ID, PURPOSE, new Date()))!

    await expect(world.otpService.check(USER_ID, PURPOSE, first, new Date())).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' })
    await expect(world.otpService.check(USER_ID, PURPOSE, second, new Date())).resolves.toBeDefined()
  })

  it('does not issue a second code inside the 60 s resend cooldown', async () => {
    expect(await world.otpService.issue(USER_ID, PURPOSE, new Date())).not.toBeNull()

    clock.advance(30 * 1000)
    expect(await world.otpService.issue(USER_ID, PURPOSE, new Date())).toBeNull()

    clock.advance(31 * 1000)
    expect(await world.otpService.issue(USER_ID, PURPOSE, new Date())).not.toBeNull()
  })

  it('caps the codes per hour, then allows again once the hour has passed', async () => {
    for (let i = 0; i < 5; i++) {
      expect(await world.otpService.issue(USER_ID, PURPOSE, new Date())).not.toBeNull()
      clock.advance(61 * 1000)
    }
    expect(await world.otpService.issue(USER_ID, PURPOSE, new Date())).toBeNull()

    clock.advance(60 * 60 * 1000)
    expect(await world.otpService.issue(USER_ID, PURPOSE, new Date())).not.toBeNull()
  })

  it('keeps purposes apart: a verification code never resets a password', async () => {
    const code = (await world.otpService.issue(USER_ID, OtpPurpose.EMAIL_VERIFICATION, new Date()))!

    await expect(world.otpService.check(USER_ID, OtpPurpose.PASSWORD_RESET, code, new Date())).rejects.toMatchObject({ errorCode: 'AUTH_INVALID_OTP' })
  })

  it('gives unknown accounts the very same error', () => {
    let thrown: unknown
    try {
      world.otpService.rejectUnknown('123456', PURPOSE)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toMatchObject({ errorCode: 'AUTH_INVALID_OTP', status: 400 })
  })
})
