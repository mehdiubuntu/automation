import { HttpException, HttpStatus } from '@nestjs/common'

export enum ErrorType {
  BUSINESS = 'business',
  SYSTEMIC = 'systemic',
  VALIDATION = 'validation',
}
export interface IErrorResponseFormat {
  statusCode: number
  message: string
  module: string
  errorCode?: string
  timestamp: string
}
export interface ErrorContext {
  className?: string
  methodName?: string
  lineNumber?: number
  originalStack?: string
  originalMessage?: string
  originalError?: Error
  internalErrorType?: InternalErrorType
  cause?: unknown
  name?: string
}
export enum InternalErrorType {
  BASE_HTTP_EXCEPTION = 'base-http-exception',
  HTTP_EXCEPTION = 'http-exception',
  UNHANDLED_INTERNAL_EXCEPTION = 'unhandled-internal-exception',
}
export enum logTypes {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}
export abstract class BaseHttpException extends HttpException {
  public readonly logType: logTypes
  public readonly moduleName: string
  public readonly errorCode?: string
  public context: ErrorContext = {}

  constructor(message: string, statusCode: HttpStatus, moduleName: string, logType: logTypes = logTypes.ERROR, errorCode?: string) {
    super(message, statusCode)
    this.logType = logType
    this.moduleName = moduleName
    this.errorCode = errorCode
  }

  // Method to enrich exception with context (called by decorator)
  setContext(context: ErrorContext): this {
    this.context = { ...this.context, ...context }
    return this
  }

  abstract getErrorResponse(): {
    statusCode: number
    message: string
    module: string
    errorCode?: string
    timestamp: string
  }

  // Full log data for internal logging (Elastic, DB, etc.)
  getFullLogData(): Record<string, unknown> {
    return {
      statusCode: this.getStatus(),
      message: this.message,
      module: this.moduleName,
      errorCode: this.errorCode,
      logType: this.logType,
      className: this.context.className,
      methodName: this.context.methodName,
      lineNumber: this.context.lineNumber,
      internalErrorType: this.context.internalErrorType,
      stack: this.context.originalStack || this.stack,
      originalMessage: this.context.originalMessage,
      originalError: this.context.originalError,
      cause: ErrorType.BUSINESS,
      name: this.name,
      timestamp: new Date().toISOString(),
    }
  }
}

export class GenericException extends BaseHttpException {
  constructor(message: string, statusCode: HttpStatus, moduleName: string, errorCode: string) {
    super(message, statusCode, moduleName, logTypes.ERROR, errorCode)
  }

  getErrorResponse(): IErrorResponseFormat {
    return {
      statusCode: this.getStatus(),
      message: this.message,
      module: this.moduleName,
      errorCode: this.errorCode,
      timestamp: new Date().toISOString(),
    }
  }
}
