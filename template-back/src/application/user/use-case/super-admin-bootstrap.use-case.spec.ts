import { fakeId } from '@application/shared/testing/fake-id'
import { buildAuthWorld, createActiveUser, DEVICE } from '@application/auth/testing/in-memory.fakes'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'

describe('SuperAdminBootstrapUseCase', () => {
  it('creates the ACTIVE, verified SUPERADMIN from the environment on first boot', async () => {
    const world = buildAuthWorld()

    await world.bootstrap.run()

    const admin = await world.users.findByEmailWithPassword(world.settings.superAdminEmail)
    expect(admin).toMatchObject({ role: UserRole.SUPERADMIN, status: UserStatus.ACTIVE })
    expect(admin!.emailVerifiedAt).toBeInstanceOf(Date)
    expect(admin!.password).toBe(`hashed(${world.settings.superAdminPassword})`)
  })

  it('is idempotent: a second boot adds no user and does not rehash an unchanged password', async () => {
    const world = buildAuthWorld()
    await world.bootstrap.run()
    const hashes = world.hasher.hashCalls

    await world.bootstrap.run()

    expect(world.users.rows).toHaveLength(1)
    expect(world.hasher.hashCalls).toBe(hashes)
  })

  it('re-syncs the hash when SUPERADMIN_PASSWORD changed and revokes the old sessions', async () => {
    const world = buildAuthWorld()
    await world.bootstrap.run()
    await world.login.login({ email: world.settings.superAdminEmail, password: world.settings.superAdminPassword }, DEVICE)
    world.settings.superAdminPassword = 'Ch4nged!Secret'

    await world.bootstrap.run()

    expect((await world.users.findByEmailWithPassword(world.settings.superAdminEmail))!.password).toBe('hashed(Ch4nged!Secret)')
    expect(world.sessions.live(fakeId(1))).toHaveLength(0)
  })

  it('repairs a tampered account (blocked, locked, unverified) back to ACTIVE', async () => {
    const world = buildAuthWorld()
    await world.bootstrap.run()
    const admin = world.users.rows[0]
    Object.assign(admin, { status: UserStatus.BLOCKED, emailVerifiedAt: null, failedLoginAttempts: 3, lockedUntil: new Date(Date.now() + 1e6) })

    await world.bootstrap.run()

    expect(admin).toMatchObject({ status: UserStatus.ACTIVE, failedLoginAttempts: 0, lockedUntil: null })
    expect(admin.emailVerifiedAt).toBeInstanceOf(Date)
  })

  it('promotes a pre-existing normal account that owns the env email, and demotes a stale SUPERADMIN', async () => {
    const world = buildAuthWorld()
    const stale = await createActiveUser(world, 'old.admin@example.test')
    world.users.rows.find((row) => row.id === stale.id)!.role = UserRole.SUPERADMIN

    await world.bootstrap.run()

    expect((await world.users.findById(stale.id!))!.role).toBe(UserRole.SPARTAN)
    expect((await world.users.findByEmail(world.settings.superAdminEmail))!.role).toBe(UserRole.SUPERADMIN)
  })
})
