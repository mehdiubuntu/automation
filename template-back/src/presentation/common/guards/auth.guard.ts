import { SessionUseCase } from '@application/auth/use-case/session.use-case'
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { FastifyRequest } from 'fastify'

export const AUTH_COOKIES = {
  ACCESS: 'accessToken',
  REFRESH: 'refreshToken',
} as const

/**
 * Requires a valid access token, a live server-side session and a user that is still ACTIVE
 * (a blocked user loses access at once). Attaches the principal to `request.user`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessionUseCase: SessionUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    request.user = await this.sessionUseCase.authenticateRequest(request.cookies?.[AUTH_COOKIES.ACCESS])
    return true
  }
}
