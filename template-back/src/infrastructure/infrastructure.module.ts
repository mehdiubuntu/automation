import { EmailSendHandler } from '@application/outbox/handler/email-send.handler'
import { SuperAdminBootstrapUseCase } from '@application/user/use-case/super-admin-bootstrap.use-case'
import { AUTH_SETTINGS_TOKEN, type IAuthSettings } from '@domain/auth/contract/auth-settings.contract'
import { EMAIL_SENDER_TOKEN } from '@domain/auth/contract/email-sender.contract'
import { PASSWORD_HASHER_TOKEN } from '@domain/auth/contract/password-hasher.contract'
import { TOKEN_PROVIDER_TOKEN } from '@domain/auth/contract/token-provider.contract'
import { AUTH_EVENT_REPOSITORY_TOKEN } from '@domain/auth-event/repository/auth-event.repository'
import { EXAMPLE_ITEM_REPOSITORY_TOKEN } from '@domain/example-item/repository/example-item.repository'
import { OTP_CODE_PROVIDER_TOKEN } from '@domain/otp/contract/otp-code.contract'
import { OTP_REPOSITORY_TOKEN } from '@domain/otp/repository/otp.repository'
import { OUTBOX_EVENT_HANDLERS } from '@domain/outbox/contract/outbox-event-handler.contract'
import { OUTBOX_REPOSITORY_TOKEN } from '@domain/outbox/repository/outbox.repository'
import { PROJECT_REPOSITORY_TOKEN } from '@domain/project/repository/project.repository'
import { SESSION_REPOSITORY_TOKEN } from '@domain/session/repository/session.repository'
import { ENGINE_CATALOG_TOKEN, JOB_QUEUE_TOKEN } from '@domain/job/job.contract'
import { HEALTH_PROBE_TOKEN } from '@domain/shared/health/health-probe.contract'
import { UNIT_OF_WORK_TOKEN } from '@domain/shared/unit-of-work/unit-of-work.interface'
import { USER_REPOSITORY_TOKEN } from '@domain/user/repository/user.repository'
import { BcryptPasswordHasher } from '@infrastructure/auth/bcrypt-password-hasher'
import { CryptoOtpCodeProvider } from '@infrastructure/auth/crypto-otp-code.provider'
import { JwtTokenProvider } from '@infrastructure/auth/jwt-token-provider'
import typeormConfig from '@infrastructure/config/database/typeorm.config'
import { AuthEventOrmEntity } from '@infrastructure/database/auth-event/orm-entity/auth-event.orm.entity'
import { AuthEventRepositoryImpl } from '@infrastructure/database/auth-event/repository/auth-event.repository.impl'
import { ExampleItemOrmEntity } from '@infrastructure/database/example-item/orm-entity/example-item.orm.entity'
import { ExampleItemRepositoryImpl } from '@infrastructure/database/example-item/repository/example-item.repository.impl'
import { Migrator } from '@infrastructure/database/migrator'
import { OtpOrmEntity } from '@infrastructure/database/otp/orm-entity/otp.orm.entity'
import { OtpRepositoryImpl } from '@infrastructure/database/otp/repository/otp.repository.impl'
import { OutboxOrmEntity } from '@infrastructure/database/outbox/orm-entity/outbox.orm.entity'
import { OutboxRepositoryImpl } from '@infrastructure/database/outbox/repository/outbox.repository.impl'
import { ProjectOrmEntity } from '@infrastructure/database/project/orm-entity/project.orm.entity'
import { ProjectRepositoryImpl } from '@infrastructure/database/project/repository/project.repository.impl'
import { SessionOrmEntity } from '@infrastructure/database/session/orm-entity/session.orm.entity'
import { SessionRepositoryImpl } from '@infrastructure/database/session/repository/session.repository.impl'
import { TypeOrmUnitOfWork } from '@infrastructure/database/shared/unit-of-work/unit-of-work.service'
import { UserOrmEntity } from '@infrastructure/database/user/orm-entity/user.orm.entity'
import { UserRepositoryImpl } from '@infrastructure/database/user/repository/user.repository.impl'
import { LogEmailSender } from '@infrastructure/email/log-email-sender'
import { SmtpEmailSender } from '@infrastructure/email/smtp-email-sender'
import { DatabBaseExceptionMapper } from '@infrastructure/error/exception-mapper'
import { HealthProbeService } from '@infrastructure/health/health-probe.service'
import { EngineRegistry, engineRegistryProvider } from '@infrastructure/jobs/engine-registry'
import { PgJobQueue } from '@infrastructure/jobs/job-queue'
import { RedisModule } from '@infrastructure/redis/redis.module'
import { AuthCleanupCronJob } from '@infrastructure/scheduler/auth-cleanup.cron'
import { OutboxDispatcherCronJob } from '@infrastructure/scheduler/outbox-dispatcher.cron'
import { SuperAdminSeeder } from '@infrastructure/seed/super-admin.seeder'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { addTransactionalDataSource, getDataSourceByName } from 'typeorm-transactional'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeormConfig().useFactory,
      // Register the DataSource with typeorm-transactional so the unit-of-work's
      // dataSource.transaction() genuinely wraps @InjectRepository writes (real atomicity).
      dataSourceFactory: async (options) => {
        if (!options) throw new Error('TypeORM options are required to build the DataSource')
        // Idempotent: the factory can be resolved more than once (ApplicationModule imports
        // InfrastructureModule), and addTransactionalDataSource throws on a duplicate name.
        const existing = getDataSourceByName('default')
        if (existing) return existing
        return addTransactionalDataSource(new DataSource(options))
      },
    }),
    // Every ORM entity must be listed here (and picked up by typeorm.config) to be usable.
    TypeOrmModule.forFeature([UserOrmEntity, OtpOrmEntity, SessionOrmEntity, AuthEventOrmEntity, OutboxOrmEntity, ProjectOrmEntity, ExampleItemOrmEntity]),
    JwtModule.register({}),
    ScheduleModule.forRoot(),
    // Opt-in via REDIS_ENABLED: exports a null REDIS_CLIENT while disabled.
    RedisModule,
  ],
  providers: [
    { provide: USER_REPOSITORY_TOKEN, useClass: UserRepositoryImpl },
    { provide: OTP_REPOSITORY_TOKEN, useClass: OtpRepositoryImpl },
    { provide: SESSION_REPOSITORY_TOKEN, useClass: SessionRepositoryImpl },
    { provide: AUTH_EVENT_REPOSITORY_TOKEN, useClass: AuthEventRepositoryImpl },
    { provide: OUTBOX_REPOSITORY_TOKEN, useClass: OutboxRepositoryImpl },
    { provide: PROJECT_REPOSITORY_TOKEN, useClass: ProjectRepositoryImpl },
    // Reference project-scoped repository: the project is an explicit filter, not ambient state.
    { provide: EXAMPLE_ITEM_REPOSITORY_TOKEN, useClass: ExampleItemRepositoryImpl },
    { provide: UNIT_OF_WORK_TOKEN, useClass: TypeOrmUnitOfWork },
    { provide: TOKEN_PROVIDER_TOKEN, useClass: JwtTokenProvider },
    { provide: PASSWORD_HASHER_TOKEN, useClass: BcryptPasswordHasher },
    { provide: OTP_CODE_PROVIDER_TOKEN, useClass: CryptoOtpCodeProvider },
    {
      // The env-resolved tunables every auth use-case reads (AuthConfig validates them at boot).
      provide: AUTH_SETTINGS_TOKEN,
      useFactory: (configService: ConfigService) => configService.getOrThrow<IAuthSettings>('AuthConfig.settings'),
      inject: [ConfigService],
    },
    {
      // SMTP when EMAIL_ENABLED=true (fail-fast config), log-only otherwise (refused in production).
      provide: EMAIL_SENDER_TOKEN,
      useFactory: (configService: ConfigService) =>
        configService.get<{ enabled: boolean }>('EmailConfig')!.enabled ? new SmtpEmailSender(configService) : new LogEmailSender(),
      inject: [ConfigService],
    },
    { provide: HEALTH_PROBE_TOKEN, useClass: HealthProbeService },
    // Background jobs: the queue table and the enabled engines (the worker process wires the same classes itself).
    PgJobQueue,
    { provide: JOB_QUEUE_TOKEN, useExisting: PgJobQueue },
    engineRegistryProvider,
    { provide: ENGINE_CATALOG_TOKEN, useExisting: EngineRegistry },
    // Applies pending SQL migrations at boot (DB_AUTO_MIGRATE) before any seeder or cron runs.
    Migrator,
    DatabBaseExceptionMapper,
    // Application-layer pieces provided here because their only callers are infrastructure entry
    // points (boot seeder, dispatcher cron): infra -> application is a legal dep-cruiser edge.
    SuperAdminBootstrapUseCase,
    SuperAdminSeeder,
    AuthCleanupCronJob,
    OutboxDispatcherCronJob,
    EmailSendHandler,
    {
      // The dispatcher's consumer registry - a new consumer is one handler class + one entry here.
      provide: OUTBOX_EVENT_HANDLERS,
      useFactory: (email: EmailSendHandler) => [email],
      inject: [EmailSendHandler],
    },
  ],
  exports: [
    DatabBaseExceptionMapper,
    USER_REPOSITORY_TOKEN,
    OTP_REPOSITORY_TOKEN,
    SESSION_REPOSITORY_TOKEN,
    AUTH_EVENT_REPOSITORY_TOKEN,
    OUTBOX_REPOSITORY_TOKEN,
    PROJECT_REPOSITORY_TOKEN,
    EXAMPLE_ITEM_REPOSITORY_TOKEN,
    UNIT_OF_WORK_TOKEN,
    TOKEN_PROVIDER_TOKEN,
    PASSWORD_HASHER_TOKEN,
    OTP_CODE_PROVIDER_TOKEN,
    AUTH_SETTINGS_TOKEN,
    EMAIL_SENDER_TOKEN,
    HEALTH_PROBE_TOKEN,
    JOB_QUEUE_TOKEN,
    ENGINE_CATALOG_TOKEN,
  ],
})
export class InfrastructureModule {}
