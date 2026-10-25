import { ApplicationModule } from '@application/application.module'
import { ErrorType } from '@domain/shared/error/base-http.exception'
import { InfrastructureModule } from '@infrastructure/infrastructure.module'
import { BadRequestException, Module, ValidationError, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE, HttpAdapterHost } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthEndPoint } from '@presentation/api/v1/auth/end-point/auth.controller'
import { ExampleItemEndPoint } from '@presentation/api/v1/example-item/end-point/example-item.controller'
import { HealthEndPoint } from '@presentation/api/v1/health/end-point/health.controller'
import { JobEndPoint } from '@presentation/api/v1/job/end-point/job.controller'
import { OutboxEndPoint } from '@presentation/api/v1/outbox/end-point/outbox.controller'
import { ProjectEndPoint } from '@presentation/api/v1/project/end-point/project.controller'
import { UserEndPoint } from '@presentation/api/v1/user/end-point/user.controller'
import { AsyncContextModule } from '@presentation/common/context/async-context.module'
import { createThrottlers } from '@presentation/common/config/throttler.factory'
import { GlobalExceptionFilter } from '@presentation/common/filters/global-exception-handler.filter'
import { AppThrottlerGuard } from '@presentation/common/guards/app-throttler.guard'
import { AuthGuard } from '@presentation/common/guards/auth.guard'
import { RolesGuard } from '@presentation/common/guards/roles.guard'
import { CorrelationIdHook } from '@presentation/common/hooks/correlationId.hook'
import { CsrfOriginHook } from '@presentation/common/hooks/csrf-origin.hook'
import { ResponseInterceptor } from '@presentation/common/interceptors/response-format.interceptor'
import { SuccessLoggerInterceptor } from '@presentation/common/interceptors/success-logger.interceptor'

/**
 * Nested DTO failures (location.online.…, participants[0].…) carry their
 * messages on `children`, not `constraints` — reading only the top level
 * produced the infamous empty `message: []`. Walk the tree and prefix nested
 * messages with their full property path so the client sees exactly which
 * field failed.
 */
const flattenValidationErrors = (errors: ValidationError[], parentPath = ''): string[] =>
  errors.flatMap((err) => {
    const path = parentPath ? `${parentPath}.${err.property}` : err.property
    const own = Object.values(err.constraints ?? {}).map((message) => (parentPath ? `${path}: ${message}` : message))
    return [...own, ...flattenValidationErrors(err.children ?? [], path)]
  })

@Module({
  imports: [
    ApplicationModule,
    AsyncContextModule,
    InfrastructureModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({ throttlers: createThrottlers(configService) }),
    }),
  ],
  controllers: [AuthEndPoint, UserEndPoint, ProjectEndPoint, ExampleItemEndPoint, JobEndPoint, OutboxEndPoint, HealthEndPoint],
  providers: [
    {
      provide: 'FASTIFY_INSTANCE',
      useFactory: (adapterHost: HttpAdapterHost) => {
        return adapterHost.httpAdapter.getInstance()
      },
      inject: [HttpAdapterHost],
    },
    // ====================================
    // ===============Hook=================
    // ====================================
    CorrelationIdHook,
    CsrfOriginHook,

    // ====================================
    // ==============Guards================
    // ====================================
    AuthGuard,
    RolesGuard,
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },

    // ====================================
    // ============Interceptor=============
    // ====================================
    {
      provide: APP_INTERCEPTOR,
      useClass: SuccessLoggerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    // ====================================
    // ===============Filter===============
    // ====================================
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // ====================================
    // ===============Pipe=================
    // ====================================
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
          exceptionFactory: (errors) =>
            new BadRequestException(
              {
                message: flattenValidationErrors(errors),
                errorCode: BadRequestException.name,
                timestamp: new Date().toISOString(),
              },
              { cause: ErrorType.VALIDATION }
            ),
        }),
    },
  ],
})
export class PresentationModule {}
