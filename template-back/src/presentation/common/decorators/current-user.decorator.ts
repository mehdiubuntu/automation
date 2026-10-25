import { AuthUser } from '@domain/auth/type/auth-user.type'
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { FastifyRequest } from 'fastify'

/** Injects the authenticated principal attached by AuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser | undefined => {
  const request = context.switchToHttp().getRequest<FastifyRequest>()
  return request.user
})
