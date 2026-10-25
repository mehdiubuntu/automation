import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { appConfig } from '@infrastructure/config/app/app.config'
import { swaggerConfig } from '@infrastructure/config/app/swagger.config'
import { Logger } from '@nestjs/common'
import { ConfigService, ConfigType } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { JsonLogger } from '@presentation/common/logger/logger-stringify'
import { initializeTransactionalContext } from 'typeorm-transactional'
import { AppModule } from './app.module'

async function bootstrap() {
  initializeTransactionalContext()
  // Config is validated (fail fast) when AppModule loads; trustProxy / bodyLimit are read from env here
  // because the Fastify adapter is built before the DI container exists.
  const adapter = new FastifyAdapter({
    trustProxy: process.env.TRUST_PROXY === 'true',
    bodyLimit: Number(process.env.BODY_LIMIT_BYTES) || 102400,
    routerOptions: { maxParamLength: 200 },
  })
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: process.env.STRINGIFY_LOGS_Enabled === 'true' ? new JsonLogger() : new Logger(),
    bufferLogs: true,
  })
  const logger = new Logger(bootstrap.name, { timestamp: true })

  app.setGlobalPrefix('api')

  // Action endpoints (approve-user/:id, logout, ...) legitimately have no body; Fastify would reject an empty JSON body.
  app.useBodyParser('application/json', {}, (_req, body, done) => {
    if (body.length === 0) return done(null, {})
    try {
      done(null, JSON.parse(body.toString('utf8')))
    } catch {
      done(Object.assign(new Error('Request body is not valid JSON.'), { statusCode: 400 }), undefined)
    }
  })

  const config = app.get<ConfigService>(ConfigService)
  const appCfg = config.getOrThrow<ConfigType<typeof appConfig>>('AppConfig')
  const swagger = config.getOrThrow<ConfigType<typeof swaggerConfig>>('SwaggerConfig')
  if (swagger.enabled) swagger.setupSwagger(app, swagger.urls ?? '')

  // Security headers. Swagger UI needs inline scripts, so CSP is only relaxed while it is enabled.
  await app.register(helmet, swagger.enabled ? { contentSecurityPolicy: false } : undefined)
  await app.register(fastifyCors, appCfg.buildCorsOptions(appCfg.allowedOrigins))
  await app.register(fastifyCookie)

  app.enableShutdownHooks()
  await app.listen(appCfg.port || 5001, '0.0.0.0')
  logger.log(`app is running on port : ${appCfg.port || 5001}`)
}
void bootstrap()
