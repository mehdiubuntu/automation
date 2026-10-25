import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { map, Observable } from 'rxjs'
import { FastifyRequest, FastifyReply } from 'fastify'

enum HttpMethod {
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  GET = 'GET',
}

enum ResponseMessage {
  CREATED = 'Created successfully',
  UPDATED = 'Updated successfully',
  DELETED = 'Deleted successfully',
  OK = 'OK',
}

interface Response<T> {
  success: boolean
  message: ResponseMessage
  statusCode: number
  data: T | null
  error: T | null
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const response = context.switchToHttp().getResponse<FastifyReply>()

    return next.handle().pipe(
      map((data) => ({
        success: true,
        message: this.resolveMessage(request.method),
        statusCode: response.statusCode,
        data: data ?? null,
        error: null,
      }))
    )
  }

  private resolveMessage(method: string): ResponseMessage {
    switch (method) {
      case HttpMethod.POST:
        return ResponseMessage.CREATED
      case HttpMethod.PUT:
      case HttpMethod.PATCH:
        return ResponseMessage.UPDATED
      case HttpMethod.DELETE:
        return ResponseMessage.DELETED
      default:
        return ResponseMessage.OK
    }
  }
}
