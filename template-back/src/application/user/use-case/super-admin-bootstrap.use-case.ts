import { AUTH_SETTINGS_TOKEN, type IAuthSettings } from '@domain/auth/contract/auth-settings.contract'
import { PASSWORD_HASHER_TOKEN, type IPasswordHasher } from '@domain/auth/contract/password-hasher.contract'
import { SESSION_REPOSITORY_TOKEN, type ISessionRepository } from '@domain/session/repository/session.repository'
import { User } from '@domain/user/aggregate/user.aggregate'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'
import { USER_REPOSITORY_TOKEN, type IUserRepository } from '@domain/user/repository/user.repository'
import { Inject, Injectable, Logger } from '@nestjs/common'

/**
 * Makes the database match SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD on every boot (idempotent): the account
 * exists as an ACTIVE, verified SUPERADMIN whose password is the one in the environment. Anyone else holding
 * the SUPERADMIN role (an earlier env email) is demoted, so the env alone defines who the operator is.
 */
@Injectable()
export class SuperAdminBootstrapUseCase {
  private readonly logger = new Logger(SuperAdminBootstrapUseCase.name)

  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private readonly users: IUserRepository,
    @Inject(SESSION_REPOSITORY_TOKEN) private readonly sessions: ISessionRepository,
    @Inject(PASSWORD_HASHER_TOKEN) private readonly hasher: IPasswordHasher,
    @Inject(AUTH_SETTINGS_TOKEN) private readonly settings: IAuthSettings
  ) {}

  async run(now = new Date()): Promise<void> {
    const { superAdminEmail: email, superAdminPassword: password } = this.settings
    const existing = await this.users.findByEmailWithPassword(email)

    if (!existing) {
      const passwordHash = await this.hasher.hash(password)
      await this.users.insertOne(User.create({ email, password: passwordHash, role: UserRole.SUPERADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: now }))
      this.logger.log('Super administrator account created from the environment')
    } else {
      const passwordInSync = !!existing.password && (await this.hasher.compare(password, existing.password))
      await this.users.syncSuperAdmin(existing.id!, passwordInSync ? undefined : await this.hasher.hash(password), now)
      if (!passwordInSync) {
        await this.sessions.revokeAllByUser(existing.id!, now)
        this.logger.log('Super administrator password re-synced from the environment; its sessions were revoked')
      }
    }

    for (const stale of await this.users.findSuperAdminsExcept(email)) {
      await this.users.updateRole(stale.id!, UserRole.SPARTAN)
      await this.sessions.revokeAllByUser(stale.id!, now)
      this.logger.warn(`User ${stale.id} was demoted: it is no longer the SUPERADMIN_EMAIL account`)
    }
  }
}
