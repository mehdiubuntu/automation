import { appConfig } from '@infrastructure/config/app/app.config'
import { swaggerConfig } from '@infrastructure/config/app/swagger.config'
import { authConfig } from '@infrastructure/config/auth/auth.config'
import { rateLimitConfig } from '@infrastructure/config/auth/rate-limit.config'
import { databaseConfig } from '@infrastructure/config/database/database.config'
import typeormConfig from '@infrastructure/config/database/typeorm.config'
import { emailConfig } from '@infrastructure/config/email/email.config'
import { jobsConfig } from '@infrastructure/config/jobs/jobs.config'
import { redisConfig } from '@infrastructure/config/redis/redis.config'

export const configs = [appConfig, swaggerConfig, authConfig, rateLimitConfig, databaseConfig, typeormConfig, redisConfig, emailConfig, jobsConfig]
