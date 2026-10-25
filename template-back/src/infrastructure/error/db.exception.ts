import { BaseHttpException, IErrorResponseFormat, logTypes } from '@domain/shared/error/base-http.exception'
import { DBErrorCode, DBErrorMessages, MODULE_NAME } from '@infrastructure/error/db.error'
import { HttpStatus } from '@nestjs/common'

// PostgreSQL SQLSTATE 23505 (unique_violation)
export class UniqueViolationException extends BaseHttpException {
  constructor(message: string = DBErrorMessages.DB_CONFLICT) {
    super(message, HttpStatus.CONFLICT, MODULE_NAME, logTypes.ERROR, DBErrorCode.CONFLICT)
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
