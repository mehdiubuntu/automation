import { AuthErrors } from '@application/auth/error/auth.errors'
import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

/** Same guard, but a refused request answers in the project envelope with a stable code (AUTH_RATE_LIMITED). */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(): Promise<void> {
    throw AuthErrors.rateLimited()
  }
}
