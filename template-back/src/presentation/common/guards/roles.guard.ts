import { AuthErrors } from '@application/auth/error/auth.errors'
import { UserRole } from '@domain/user/enum/user.enum'
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '@presentation/common/decorators/roles.decorator'
import { FastifyRequest } from 'fastify'

/**
 * Role check, to be placed after AuthGuard: `@UseGuards(AuthGuard, RolesGuard)` + `@Roles(...)`.
 * Fails closed: a route that declares no roles is denied, so forgetting `@Roles` can never open a route.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()])
    const role = context.switchToHttp().getRequest<FastifyRequest>().user?.role
    if (!allowed?.length || !role || !allowed.includes(role)) {
      throw AuthErrors.forbidden()
    }
    return true
  }
}
