import { InternalErrorType } from '@domain/shared/error/base-http.exception'
import { HttpException, HttpStatus } from '@nestjs/common'

export class UnhandledInternalException extends HttpException {
  public readonly className: string
  public readonly methodName: string
  public readonly lineNumber?: number
  public readonly statusCode?: number
  public readonly originalStack?: string
  public readonly originalError?: unknown
  public readonly name: string
  public readonly cause: unknown
  public readonly internalErrorType?: InternalErrorType
  constructor(props: {
    message: string
    className: string
    methodName: string
    name: string
    statusCode?: number
    lineNumber?: number
    originalStack?: string
    internalErrorType?: InternalErrorType
    originalError?: unknown
    cause: unknown
  }) {
    super(props.message, props.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR)
    this.className = props.className
    this.methodName = props.methodName
    this.statusCode = props.statusCode
    this.lineNumber = props.lineNumber
    this.originalStack = props.originalStack
    this.internalErrorType = props.internalErrorType
    this.originalError = props.originalError
    this.name = props.name
    this.cause = props.cause
  }

  getFullLogData(): Record<string, unknown> {
    return {
      statusCode: this.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.message,
      className: this.className,
      methodName: this.methodName,
      lineNumber: this.lineNumber,
      internalErrorType: this.internalErrorType,
      stack: this.stack,
      originalStack: this.originalStack,
      originalError: this.originalError,
      cause: this.cause,
      name: this.name,
      timestamp: new Date().toISOString(),
    }
  }
}
