import { configs } from '@infrastructure/config'
import typeormConfig from '@infrastructure/config/database/typeorm.config'
import { Migrator } from '@infrastructure/database/migrator'
import { EngineContextFactory } from '@infrastructure/jobs/engine-context'
import { engineRegistryProvider } from '@infrastructure/jobs/engine-registry'
import { PgJobQueue } from '@infrastructure/jobs/job-queue'
import { JobWorker } from '@infrastructure/jobs/job-worker'
import { Logger, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JsonLogger } from '@presentation/common/logger/logger-stringify'

/**
 * The background half of the app: the same image as the API, started with `node dist/worker.js` (npm run worker:dev).
 * It serves no HTTP and loads only what jobs need - never the auth stack, the seeders or the crons.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      load: configs,
    }),
    TypeOrmModule.forRootAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: typeormConfig().useFactory }),
  ],
  providers: [engineRegistryProvider, Migrator, PgJobQueue, EngineContextFactory, JobWorker],
})
class WorkerModule {}

async function bootstrap(): Promise<void> {
  // No bufferLogs: Nest only flushes buffered logs for HTTP apps, so a buffered worker would run silently.
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: process.env.STRINGIFY_LOGS_Enabled === 'true' ? new JsonLogger() : new Logger(),
  })
  // SIGTERM / SIGINT: stop claiming, let running jobs finish, hand the rest back to the queue.
  app.enableShutdownHooks()
}
void bootstrap()
