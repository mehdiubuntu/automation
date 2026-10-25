import { buildAuthWorld, DEVICE } from '@application/auth/testing/in-memory.fakes'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { OutboxEventType } from '@domain/outbox/enum/outbox.enum'
import { User } from '@domain/user/aggregate/user.aggregate'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'

const input = { email: 'new.user@example.test', password: 'Str0ng!Pass' }

describe('RegistrationUseCase', () => {
  it('creates a SPARTAN waiting for email verification, with a hashed password and a queued OTP email', async () => {
    const world = buildAuthWorld()

    await world.registration.register(input, DEVICE)

    const user = await world.users.findByEmailWithPassword(input.email)
    expect(user).toMatchObject({ role: UserRole.SPARTAN, status: UserStatus.PENDING_VERIFICATION })
    expect(user!.password).toBe('hashed(Str0ng!Pass)')
    expect(world.outbox.rows).toHaveLength(1)
    expect(world.outbox.rows[0]).toMatchObject({ eventType: OutboxEventType.SEND_EMAIL_VERIFICATION_OTP, aggregateId: input.email })
    expect(world.outbox.lastCode()).toMatch(/^\d{6}$/)
    expect(world.authEvents.types()).toEqual([AuthEventType.REGISTERED])
  })

  it('stores the OTP only as a hash', async () => {
    const world = buildAuthWorld()

    await world.registration.register(input, DEVICE)

    expect(world.otps.rows[0].codeHash).not.toContain(world.outbox.lastCode() + 'x')
    expect(world.otps.rows[0].codeHash).not.toBe(world.outbox.lastCode())
  })

  it('answers an already-registered email exactly like a new one: no error, no email, no second account', async () => {
    const world = buildAuthWorld()
    await world.registration.register(input, DEVICE)
    const queuedBefore = world.outbox.rows.length

    await expect(world.registration.register({ ...input, password: 'Other!Pass1' }, DEVICE)).resolves.toBeUndefined()

    expect(world.users.rows).toHaveLength(1)
    expect(world.outbox.rows).toHaveLength(queuedBefore)
    expect(world.users.rows[0].password).toBe('hashed(Str0ng!Pass)')
  })

  it('does the same bcrypt work for a duplicate as for a new email (timing equalisation)', async () => {
    const world = buildAuthWorld()
    await world.registration.register(input, DEVICE)
    const hashesAfterFirst = world.hasher.hashCalls

    await world.registration.register(input, DEVICE)

    expect(world.hasher.hashCalls).toBe(hashesAfterFirst + 1)
  })

  it('rejects the super admin email with the same generic outcome and never creates the account', async () => {
    const world = buildAuthWorld()

    await expect(world.registration.register({ email: world.settings.superAdminEmail, password: 'Str0ng!Pass' }, DEVICE)).resolves.toBeUndefined()

    expect(world.users.rows).toHaveLength(0)
    expect(world.outbox.rows).toHaveLength(0)
  })

  it('normalises the email before looking it up', async () => {
    const world = buildAuthWorld()
    await world.registration.register(input, DEVICE)

    await world.registration.register({ email: '  NEW.User@Example.TEST ', password: 'Str0ng!Pass' }, DEVICE)

    expect(world.users.rows).toHaveLength(1)
  })

  it('treats a lost unique-index race as a duplicate, not an error', async () => {
    const world = buildAuthWorld()
    const insert = world.users.insertOne.bind(world.users) as (user: User) => Promise<User>
    jest.spyOn(world.users, 'insertOne').mockImplementationOnce(async (entity: User) => {
      await insert(entity)
      throw new Error('duplicate key value violates unique constraint')
    })

    await expect(world.registration.register(input, DEVICE)).resolves.toBeUndefined()
  })

  it('still surfaces unexpected failures when the account does not exist', async () => {
    const world = buildAuthWorld()
    jest.spyOn(world.users, 'insertOne').mockRejectedValueOnce(new Error('connection lost'))

    await expect(world.registration.register(input, DEVICE)).rejects.toThrow('connection lost')
  })
})
