import { DeviceContext } from '@domain/session/service/device-info'
import { FastifyRequest } from 'fastify'

/** The request facts recorded with sessions and audit events. `request.ip` already honours TRUST_PROXY; X-Forwarded-For is never read directly (spoofable). */
export function deviceContextOf(request: FastifyRequest): DeviceContext {
  return {
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  }
}
