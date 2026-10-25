import { boolEnv } from '@infrastructure/config/env.util'
import { registerAs } from '@nestjs/config'

/** Every core table lives in this Postgres schema. Jobs and each engine own a schema of their own (see Migrator). */
export const CORE_SCHEMA = 'platform'

export const databaseConfig = registerAs('DatabaseConfig', () => {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    /** Apply pending migrations at boot (API and worker), serialized by a Postgres advisory lock. */
    autoMigrate: boolEnv('DB_AUTO_MIGRATE', true),
    logging: process.env.DB_LOGGING === 'true',
  }
})
