import { AuthErrorCode } from '@application/auth/error/auth.errors'
import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { isOriginAllowed } from '@presentation/common/utils/origin-check.util'
import { type FastifyInstance } from 'fastify/types/instance'

/** Rejects state-changing requests whose Origin/Referer is not in CORS_ORIGINS (cookies are the credential, so this is the CSRF wall). */
@Injectable()
export class CsrfOriginHook implements OnModuleInit {
  private readonly allowedOrigins: string[]

  constructor(
    @Inject('FASTIFY_INSTANCE')
    private readonly fastifyInstance: FastifyInstance,
    configService: ConfigService
  ) {
    this.allowedOrigins = configService.get<string[]>('AppConfig.allowedOrigins') ?? []
  }

  onModuleInit() {
    this.fastifyInstance.addHook('onRequest', async (req, reply) => {
      const allowed = isOriginAllowed({
        method: req.method,
        origin: req.headers.origin,
        referer: req.headers.referer,
        hasCookies: !!req.headers.cookie,
        allowedOrigins: this.allowedOrigins,
      })
      if (!allowed) {
        return reply.code(403).send({
          success: false,
          message: 'business',
          statusCode: 403,
          data: null,
          error: { message: 'Request origin is not allowed.', errorCode: AuthErrorCode.ORIGIN_NOT_ALLOWED, timestamp: new Date().toISOString() },
        })
      }
    })
  }
}
