import { UniqueViolationException } from '@infrastructure/error/db.exception'
import { Injectable } from '@nestjs/common'
import { QueryFailedError } from 'typeorm'

interface IDriverError extends Error {
  code?: string
}
@Injectable()
export class DatabBaseExceptionMapper {
  cordinator(exception: unknown) {
    if (exception instanceof QueryFailedError) {
      const driverError: IDriverError = exception.driverError ?? exception
      const errorCode = driverError.code
      if (errorCode === '23505') return new UniqueViolationException().setContext({ originalMessage: driverError.message, originalStack: driverError.stack })
    }
    // future errors
  }
}
