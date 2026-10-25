import { fakeId } from '@application/shared/testing/fake-id'
import { AuthWorld, buildAuthWorld, createActiveUser, DEVICE } from '@application/auth/testing/in-memory.fakes'
import { AuthUser } from '@domain/auth/type/auth-user.type'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'

const admin = (id: string): AuthUser => ({ userId: id, email: 'root@example.test', role: UserRole.SUPERADMIN, status: UserStatus.ACTIVE, sessionId: 'admin-session' })

async function pendingUser(world: AuthWorld, email = 'pending@example.test') {
  await world.registration.register({ email, password: 'Str0ng!Pass' }, DEVICE)
  await world.emailVerification.verifyEmail({ email, code: world.outbox.lastCode() }, DEVICE)
  return (await world.users.findByEmail(email))!
}

describe('UserAdminUseCase', () => {
  let world: AuthWorld
  let root: AuthUser

  beforeEach(async () => {
    world = buildAuthWorld()
    await world.bootstrap.run()
    root = admin((await world.users.findByEmail(world.settings.superAdminEmail))!.id!)
  })

  it('approves a user waiting for approval and audits who did it', async () => {
    const user = await pendingUser(world)

    const result = await world.userAdmin.approveUser(root, user.id!, DEVICE)

    expect(result).toMatchObject({ id: user.id, status: UserStatus.ACTIVE })
    expect(JSON.stringify(result)).not.toContain('hashed(')
    expect(world.authEvents.rows.find((event) => event.type === AuthEventType.APPROVED)).toMatchObject({ userId: user.id, actorUserId: root.userId })
  })

  it('rejects a pending user (BLOCKED) and refuses to approve the same account twice', async () => {
    const user = await pendingUser(world)

    await expect(world.userAdmin.rejectUser(root, user.id!, DEVICE)).resolves.toMatchObject({ status: UserStatus.BLOCKED })

    await expect(world.userAdmin.approveUser(root, user.id!, DEVICE)).rejects.toMatchObject({ errorCode: 'USER_002', status: 409 })
    expect(world.authEvents.types()).toContain(AuthEventType.REJECTED)
  })

  it('blocking revokes every session immediately; unblocking makes the user ACTIVE again', async () => {
    const user = await createActiveUser(world)
    await world.login.login({ email: user.email!, password: 'Str0ng!Pass' }, DEVICE)
    await world.login.login({ email: user.email!, password: 'Str0ng!Pass' }, DEVICE)

    await world.userAdmin.blockUser(root, user.id!, DEVICE)
    expect(world.sessions.live(user.id!)).toHaveLength(0)
    await expect(world.login.login({ email: user.email!, password: 'Str0ng!Pass' }, DEVICE)).rejects.toMatchObject({ errorCode: 'AUTH_BLOCKED' })

    await world.userAdmin.unblockUser(root, user.id!, DEVICE)
    await expect(world.login.login({ email: user.email!, password: 'Str0ng!Pass' }, DEVICE)).resolves.toBeDefined()
    expect(world.authEvents.types()).toEqual(expect.arrayContaining([AuthEventType.BLOCKED, AuthEventType.UNBLOCKED]))
  })

  it('refuses transitions from the wrong status (unblock an active user, block a blocked one)', async () => {
    const user = await createActiveUser(world)

    await expect(world.userAdmin.unblockUser(root, user.id!, DEVICE)).rejects.toMatchObject({ errorCode: 'USER_002' })
    await world.userAdmin.blockUser(root, user.id!, DEVICE)
    await expect(world.userAdmin.blockUser(root, user.id!, DEVICE)).rejects.toMatchObject({ errorCode: 'USER_002' })
  })

  it('never lets the super admin be blocked, rejected, unblocked or have sessions revoked through the API', async () => {
    for (const action of [
      () => world.userAdmin.blockUser(root, root.userId, DEVICE),
      () => world.userAdmin.rejectUser(root, root.userId, DEVICE),
      () => world.userAdmin.unblockUser(root, root.userId, DEVICE),
      () => world.userAdmin.approveUser(root, root.userId, DEVICE),
      () => world.userAdmin.revokeUserSessions(root, root.userId, DEVICE),
    ]) {
      await expect(action()).rejects.toMatchObject({ errorCode: 'USER_003', status: 403 })
    }
    expect((await world.users.findById(root.userId))!.status).toBe(UserStatus.ACTIVE)
  })

  it('answers 404 for a missing user', async () => {
    await expect(world.userAdmin.approveUser(root, fakeId(4242), DEVICE)).rejects.toMatchObject({ errorCode: 'USER_001', status: 404 })
    await expect(world.userAdmin.getUserSessions(fakeId(4242))).rejects.toMatchObject({ errorCode: 'USER_001' })
  })

  it('lists users filtered by status and exposes no password hash', async () => {
    await pendingUser(world)
    await createActiveUser(world)

    const pending = await world.userAdmin.getUsers({ status: UserStatus.PENDING_APPROVAL })

    expect(pending.data).toHaveLength(1)
    expect(Object.keys(pending.data[0]).sort()).toEqual(['createdAt', 'email', 'emailVerifiedAt', 'id', 'role', 'status'])
  })

  it('lists a user sessions and revokes them all with an audit event naming the admin', async () => {
    const user = await createActiveUser(world)
    await world.login.login({ email: user.email!, password: 'Str0ng!Pass' }, DEVICE)
    await world.login.login({ email: user.email!, password: 'Str0ng!Pass' }, DEVICE)

    expect(await world.userAdmin.getUserSessions(user.id!)).toHaveLength(2)
    await expect(world.userAdmin.revokeUserSessions(root, user.id!, DEVICE)).resolves.toEqual({ revoked: 2 })

    expect(await world.userAdmin.getUserSessions(user.id!)).toHaveLength(0)
    expect(world.authEvents.rows.find((event) => event.type === AuthEventType.SESSION_REVOKED)).toMatchObject({ userId: user.id, actorUserId: root.userId })
  })

  it('filters the audit trail by user and type', async () => {
    const user = await createActiveUser(world)
    await world.login.login({ email: user.email!, password: 'Str0ng!Pass' }, DEVICE)

    const result = await world.userAdmin.getAuthEvents({ userId: user.id!, type: AuthEventType.LOGIN_SUCCESS })

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({ userId: user.id, type: AuthEventType.LOGIN_SUCCESS, ip: DEVICE.ip })
  })
})
