import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { AsyncContextService, RequestContext } from '@presentation/common/context/async-context.service'
import { FastifyRequest } from 'fastify'
import { type FastifyInstance } from 'fastify/types/instance'
import { v4 as uuidv4 } from 'uuid'

const CORRELATION_HEADER = 'x-correlation-id'
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/

@Injectable()
export class CorrelationIdHook implements OnModuleInit {
  constructor(
    @Inject('FASTIFY_INSTANCE')
    private readonly fastifyInstance: FastifyInstance,
    private readonly asyncContextService: AsyncContextService
  ) {}

  onModuleInit() {
    this.fastifyInstance.addHook('onRequest', (req, reply, done) => {
      const correlationId = this.resolveCorrelationId(req)
      reply.header(CORRELATION_HEADER, correlationId)
      const store: RequestContext = {
        correlationId,
        requestIp: this.resolveRequestIp(req),
      }
      this.asyncContextService.run(store, () => done())
    })
  }

  private resolveCorrelationId(req: FastifyRequest): string {
    const header = req.headers[CORRELATION_HEADER]
    return typeof header === 'string' && CORRELATION_ID_PATTERN.test(header) ? header : uuidv4()
  }

  // req.ip honours TRUST_PROXY; X-Forwarded-For is never read directly because clients can forge it.
  private resolveRequestIp(req: FastifyRequest): string {
    return req.ip
  }
}
