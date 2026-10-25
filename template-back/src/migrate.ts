import { databaseConfig } from '@infrastructure/config/database/database.config'
import { jobsConfig } from '@infrastructure/config/jobs/jobs.config'
import { applyMigrations, discoverMigrations, pendingMigrations } from '@infrastructure/database/migrator'
import { resolveEnabledEngines } from '@infrastructure/jobs/engine-registry'
import { Logger } from '@nestjs/common'
import { DataSource } from 'typeorm'

/**
 * `npm run migration:run` (dev) / `node dist/migrate.js` (production): applies pending migrations and exits, for pipelines that
 * migrate as a deploy step (run the app with DB_AUTO_MIGRATE=false). `--status` only lists what is pending.
 */
async function main(): Promise<void> {
  const logger = new Logger('migrate')
  try {
    process.loadEnvFile(`.env.${process.env.NODE_ENV || 'development'}`)
  } catch {
    // No env file: the variables come from the environment itself.
  }
  const db = databaseConfig()
  const dataSource = new DataSource({ type: 'postgres', host: db.host, port: db.port, username: db.username, password: db.password, database: db.database })
  await dataSource.initialize()
  try {
    const files = discoverMigrations(resolveEnabledEngines(jobsConfig().enabledEngines).map((engine) => engine.id))
    if (process.argv.includes('--status')) {
      const pending = await pendingMigrations(dataSource, files)
      logger.log(pending.length > 0 ? `${pending.length} pending: ${pending.join(', ')}` : 'database is up to date')
      return
    }
    const applied = await applyMigrations(dataSource, files, (message) => logger.log(message))
    logger.log(applied.length > 0 ? `${applied.length} migration(s) applied` : 'database is up to date')
  } finally {
    await dataSource.destroy()
  }
}

main().catch((error: Error) => {
  new Logger('migrate').error(error.message)
  process.exit(1)
})
