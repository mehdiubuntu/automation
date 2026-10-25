import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { QueryFailedError } from 'typeorm'
import { FastifyRequest, FastifyReply } from 'fastify'
import { BaseHttpException, ErrorType, InternalErrorType, logTypes } from '@domain/shared/error/base-http.exception'
import { UnhandledInternalException } from '@domain/shared/error/unhandled-internal-exception'
import { DatabBaseExceptionMapper } from '@infrastructure/error/exception-mapper'
import { AsyncContextService } from '@presentation/common/context/async-context.service'
import { redactSensitive } from '@presentation/common/utils/redact.util'

interface ErrorDetails {
  message?: string
  errorCode?: string
  timestamp?: string
  details?: string | object
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly databBaseExceptionMapper: DatabBaseExceptionMapper,
    private readonly asyncContextService: AsyncContextService
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<FastifyReply>()
    const req = ctx.getRequest<FastifyRequest>()

    // Get correlation ID from async context
    const correlationId = this.asyncContextService.getCorrelationId() || (req.headers['x-correlation-id'] as string)

    // db exception mapper
    if (exception instanceof QueryFailedError) exception = this.databBaseExceptionMapper.cordinator(exception)

    // Log all errors for internal tracking
    this.logException(exception, req, correlationId)

    //=================================
    // Handle custom BaseHttpException
    //=================================

    if (exception instanceof BaseHttpException) {
      const errorResponse = exception.getErrorResponse()
      const status = exception.getStatus()
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        return res.code(status).send(
          this.formatErrorResponse({
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: ErrorType.BUSINESS,
            error: { message: 'A temporary problem occurred. Please try again.' },
          })
        )
      }

      //handle custom bussiness errors that we want client to see here
      return res.code(status).send(
        this.formatErrorResponse({
          status: errorResponse.statusCode,
          message: ErrorType.BUSINESS,
          error: {
            message: errorResponse.message,
            errorCode: errorResponse.errorCode,
            timestamp: errorResponse.timestamp,
          },
        })
      )
    }

    //=================================
    // Handle UnhandledInternalException from @TryCatch
    //=================================

    if (exception instanceof UnhandledInternalException) {
      return res.code(HttpStatus.INTERNAL_SERVER_ERROR).send(
        this.formatErrorResponse({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: ErrorType.SYSTEMIC,
          error: { message: 'A temporary problem occurred. Please try again.' },
        })
      )
    }
    //=================================
    // Handle standard HttpException
    //=================================

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const detail = exception.getResponse()
      const msg = exception.message

      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        return res.code(status).send(
          this.formatErrorResponse({
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: ErrorType.SYSTEMIC,
            error: {
              message: msg || 'A temporary problem occurred. Please try again.',
            },
          })
        )
      }

      //====================================
      // validation errors from our pipe
      //====================================

      if (exception.cause === ErrorType.VALIDATION) {
        return res.code(status).send(
          this.formatErrorResponse({
            status: status,
            message: ErrorType.VALIDATION,
            error: typeof detail === 'string' ? { message: detail } : detail,
          })
        )
      }
      //====================================
      //          route not found
      //====================================
      if (exception.getStatus() === HttpStatus.NOT_FOUND) {
        return res.code(status).send(
          this.formatErrorResponse({
            status: status,
            message: ErrorType.SYSTEMIC,
            error: {
              message: exception.message,
              errorCode: 'Not Found',
              timestamp: new Date().toISOString(),
            },
          })
        )
      }

      // not internal server error, so we can return the response (new httpException class)
      return res.code(status).send(
        this.formatErrorResponse({
          status: status,
          message: ErrorType.SYSTEMIC,
          error: typeof detail === 'string' ? { message: detail } : detail,
        })
      )
    }
    //=================================
    // =======Unknown error============
    //=================================

    return res.code(HttpStatus.INTERNAL_SERVER_ERROR).send(
      this.formatErrorResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: ErrorType.SYSTEMIC,
        error: {
          message: 'A temporary problem occurred. Please try again.',
        },
      })
    )
  }
  //========================================================================================================
  private logException(exception: unknown, req: FastifyRequest, correlationId: string) {
    let logData: Record<string, unknown>

    if (exception instanceof BaseHttpException) {
      logData = { ...exception.getFullLogData(), internalErrorType: InternalErrorType.BASE_HTTP_EXCEPTION }
    } else if (exception instanceof UnhandledInternalException) {
      logData = { ...exception.getFullLogData(), internalErrorType: InternalErrorType.UNHANDLED_INTERNAL_EXCEPTION }
    } else if (exception instanceof HttpException) {
      logData = {
        statusCode: exception.getStatus(),
        message: exception.message,
        internalErrorType: InternalErrorType.HTTP_EXCEPTION,
        stack: exception.stack,
        originalError: exception.getResponse(),
        name: exception.name,
        cause: exception.cause,
      }
    } else {
      const err = exception instanceof Error ? exception : new Error(String(exception))
      logData = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        internalErrorType: InternalErrorType.UNHANDLED_INTERNAL_EXCEPTION,
        message: err.message,
        stack: err.stack,
        cause: err.cause,
        name: err.name,
      }
    }
    const logger = new Logger(GlobalExceptionFilter.name)
    logger.error({
      logTypes: logTypes.ERROR,
      fileName: (logData.module as string) || 'unknown',
      className: logData.className as string,
      methodName: logData.methodName as string,
      method: req.method,
      lineNumber: (logData.lineNumber as number) || 0,
      message: logData.message as string,
      stack: logData.stack as string,
      requestBody: redactSensitive(req.body || req.query || req.params),
      errorCode: logData.errorCode as string,
      statusCode: logData.statusCode as number,
      internalErrorType: logData.internalErrorType as InternalErrorType,
      originalError: logData.originalError,
      cause: logData.cause || ErrorType.SYSTEMIC,
      description: logData.description,
      originalMessage: logData.originalMessage || undefined,
      name: logData.name,
      correlationId,
      timeStamp: new Date().toISOString(),
    })
  }

  private formatErrorResponse(params: { status: HttpStatus; message: string; error: ErrorDetails }) {
    return {
      success: false,
      message: params.message,
      statusCode: params.status,
      data: null,
      error: params.error,
    }
  }
}
