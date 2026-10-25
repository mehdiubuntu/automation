import { AuthUser } from '@domain/auth/type/auth-user.type'

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
  }
}
