import { BaseHttpException, InternalErrorType, logTypes } from '@domain/shared/error/base-http.exception'
import { UnhandledInternalException } from '@domain/shared/error/unhandled-internal-exception'
import { HttpException } from '@nestjs/common'

interface TryCatchOptions {
  rethrow?: boolean // Default true - always rethrow for global handler
  logLevel?: logTypes
}

/**
 * Extracts line number from stack trace
 */
function extractLineNumber(stack: string | undefined, methodName: string): number | undefined {
  if (!stack) return undefined

  const lines = stack.split('\n')
  for (const line of lines) {
    if (line.includes(methodName)) {
      const match = line.match(/:(\d+):\d+\)?$/)
      if (match) return parseInt(match[1], 10)
    }
  }
  return undefined
}

/**
 * Class decorator that wraps all methods with try-catch
 */
export function TryCatch(options: TryCatchOptions = {}) {
  const { rethrow = true } = options

  return function <T extends new (...args: any[]) => {}>(constructor: T) {
    const className = constructor.name

    // Get all method names from the prototype
    const methodNames = Object.getOwnPropertyNames(constructor.prototype).filter((name) => {
      if (name === 'constructor') return false
      const descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, name)
      return descriptor && typeof descriptor.value === 'function'
    })

    for (const methodName of methodNames) {
      const originalMethod = constructor.prototype[methodName]

      constructor.prototype[methodName] = function (...args: any[]) {
        try {
          const result = originalMethod.apply(this, args)
          // Handle both sync and async methods
          // if (result instanceof Promise) {
          //   return await result;
          // }
          return result
        } catch (error: unknown) {
          const lineNumber = extractLineNumber(error instanceof Error ? error.stack : undefined, methodName)
          //================================================
          //  BaseHttpException, enrich it with context( NEW BASE HTTP EXCEPTION CLASS)
          //================================================
          if (error instanceof BaseHttpException) {
            error.setContext({
              internalErrorType: InternalErrorType.BASE_HTTP_EXCEPTION,
              className,
              methodName,
              lineNumber,
              cause: error.cause,
              name: error.name,
              originalStack: error.stack,
            })

            if (rethrow) throw error
            return
          }
          //================================================
          //  HttpException, enrich and rethrow (NEW HTTP EXCEPTION CLASS)
          //================================================

          if (error instanceof HttpException) {
            const wrappedError = new UnhandledInternalException({
              message: error.message,
              className: className,
              methodName: methodName,
              statusCode: error.getStatus(),
              lineNumber: lineNumber,
              originalStack: error.stack,
              cause: error.cause,
              name: error.name,
              internalErrorType: InternalErrorType.HTTP_EXCEPTION,
              originalError: error.getResponse(),
            })
            if (rethrow) throw wrappedError
            return
          }
          //================================================
          // For unknown errors, wrap them and add context (NEW ERROR CLASS)
          //================================================
          const unknownError = error instanceof Error ? error : new Error(String(error))
          const wrappedError = new UnhandledInternalException({
            message: unknownError.message,
            className: className,
            methodName: methodName,
            statusCode: undefined,
            lineNumber: lineNumber,
            originalStack: unknownError.stack,
            name: unknownError.name,
            cause: unknownError.cause,
            internalErrorType: InternalErrorType.UNHANDLED_INTERNAL_EXCEPTION,
          })
          if (rethrow) throw wrappedError
        }
      }
    }

    return constructor
  }
}
