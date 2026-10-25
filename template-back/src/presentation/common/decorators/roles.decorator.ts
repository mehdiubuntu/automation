import { UserRole } from '@domain/user/enum/user.enum'
import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'roles'

/** Roles allowed to call the handler (or the whole controller). RolesGuard denies a route that declares none. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)
