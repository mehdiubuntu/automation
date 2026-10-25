import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { AsyncContextService } from '@presentation/common/context/async-context.service'
import { FastifyReply, FastifyRequest } from 'fastify'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

@Injectable()
export class SuccessLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SuccessLoggerInterceptor.name)
  constructor(private readonly asyncContextService: AsyncContextService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp()
    const req = ctx.getRequest<FastifyRequest>()
    const res = ctx.getResponse<FastifyReply>()

    const method = req.method
    const path = req.url
    const now = Date.now()
    const correlationId = this.asyncContextService.getCorrelationId()

    return next.handle().pipe(
      tap(() => {
        const statusCode = res.statusCode
        this.logger.log(`${correlationId} ${method} ${path} ${statusCode} - ${Date.now() - now}ms`)
      })
    )
  }
}
