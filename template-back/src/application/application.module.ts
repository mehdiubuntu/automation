import { AuthEventService } from '@application/auth/service/auth-event.service'
import { OtpService } from '@application/auth/service/otp.service'
import { SessionService } from '@application/auth/service/session.service'
import { EmailVerificationUseCase } from '@application/auth/use-case/email-verification.use-case'
import { LoginUseCase } from '@application/auth/use-case/login.use-case'
import { PasswordUseCase } from '@application/auth/use-case/password.use-case'
import { RegistrationUseCase } from '@application/auth/use-case/registration.use-case'
import { SessionUseCase } from '@application/auth/use-case/session.use-case'
import { ExampleItemUseCase } from '@application/example-item/use-case/example-item.use-case'
import { HealthUseCase } from '@application/health/use-case/health.use-case'
import { JobUseCase } from '@application/job/job.use-case'
import { OutboxMonitoringUseCase } from '@application/outbox/use-case/outbox-monitoring.use-case'
import { ProjectUseCase } from '@application/project/use-case/project.use-case'
import { UserAdminUseCase } from '@application/user/use-case/user-admin.use-case'
import { InfrastructureModule } from '@infrastructure/infrastructure.module' // we are ashamed that we import from outer layer here
import { Module } from '@nestjs/common'

@Module({
  imports: [InfrastructureModule],
  providers: [
    AuthEventService,
    OtpService,
    SessionService,
    RegistrationUseCase,
    EmailVerificationUseCase,
    LoginUseCase,
    PasswordUseCase,
    SessionUseCase,
    UserAdminUseCase,
    ProjectUseCase,
    ExampleItemUseCase,
    JobUseCase,
    OutboxMonitoringUseCase,
    HealthUseCase,
  ],
  exports: [
    RegistrationUseCase,
    EmailVerificationUseCase,
    LoginUseCase,
    PasswordUseCase,
    SessionUseCase,
    UserAdminUseCase,
    ProjectUseCase,
    ExampleItemUseCase,
    JobUseCase,
    OutboxMonitoringUseCase,
    HealthUseCase,
  ],
})
export class ApplicationModule {}
