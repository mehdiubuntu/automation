import { GenericException } from '@domain/shared/error/base-http.exception'
import { UserRole } from '@domain/user/enum/user.enum'
import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Roles } from '@presentation/common/decorators/roles.decorator'
import { RolesGuard } from '@presentation/common/guards/roles.guard'

class OpenController {
  noRoles() {}

  @Roles(UserRole.SUPERADMIN)
  adminOnly() {}

  @Roles(UserRole.SPARTAN, UserRole.SUPERADMIN)
  anyRole() {}
}

const contextFor = (handler: () => void, role?: UserRole): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => OpenController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  }) as unknown as ExecutionContext

// Reflect.get keeps the decorated function itself (with its metadata) without tripping unbound-method.
const handler = (name: keyof OpenController): (() => void) => Reflect.get(OpenController.prototype, name)

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector())

  it('lets a role listed on the handler through', () => {
    expect(guard.canActivate(contextFor(handler('adminOnly'), UserRole.SUPERADMIN))).toBe(true)
    expect(guard.canActivate(contextFor(handler('anyRole'), UserRole.SPARTAN))).toBe(true)
  })

  it('denies a role that is not listed with AUTH_FORBIDDEN', () => {
    expect.assertions(2)
    try {
      guard.canActivate(contextFor(handler('adminOnly'), UserRole.SPARTAN))
    } catch (error) {
      expect(error).toBeInstanceOf(GenericException)
      expect(error).toMatchObject({ errorCode: 'AUTH_FORBIDDEN', status: 403 })
    }
  })

  it('fails closed when the route declares no roles', () => {
    expect(() => guard.canActivate(contextFor(handler('noRoles'), UserRole.SUPERADMIN))).toThrow(GenericException)
  })

  it('denies a request that was never authenticated', () => {
    expect(() => guard.canActivate(contextFor(handler('anyRole')))).toThrow(GenericException)
  })
})
