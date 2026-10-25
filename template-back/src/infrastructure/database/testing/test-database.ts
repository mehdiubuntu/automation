import { CORE_SCHEMA } from '@infrastructure/config/database/database.config'
import { CustomNamingStrategy } from '@infrastructure/config/database/naming.strategy'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { DataSource } from 'typeorm'

/**
 * Integration specs need a real PostgreSQL 18: set TEST_DATABASE_URL (for example postgres://app:app123456@localhost:5432/postgres).
 * Without it they are skipped. Every spec file gets its own throw-away database, dropped afterwards.
 */
export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL)
export const describeWithDatabase = hasTestDatabase ? describe : describe.skip

export interface TestDatabase {
  name: string
  /** A new DataSource on this database. `withEntities` loads the core ORM entities (schema "platform"). Destroyed by drop(). */
  connect(withEntities?: boolean): Promise<DataSource>
  drop(): Promise<void>
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const base = new URL(process.env.TEST_DATABASE_URL as string)
  const name = `test_${randomBytes(6).toString('hex')}`
  const connection = (database: string) => ({
    type: 'postgres' as const,
    host: base.hostname,
    port: Number(base.port) || 5432,
    username: decodeURIComponent(base.username),
    password: decodeURIComponent(base.password),
    database,
  })
  // CREATE / DROP DATABASE run on the maintenance database named in TEST_DATABASE_URL.
  const asAdmin = async (statement: string) => {
    const admin = new DataSource(connection(base.pathname.slice(1) || 'postgres'))
    await admin.initialize()
    try {
      await admin.query(statement)
    } finally {
      await admin.destroy()
    }
  }
  await asAdmin(`CREATE DATABASE ${name}`)

  const sources: DataSource[] = []
  return {
    name,
    async connect(withEntities = false) {
      const dataSource = new DataSource({
        ...connection(name),
        schema: CORE_SCHEMA,
        entities: withEntities ? [join(__dirname, '..', '..', '**', '*.entity.{ts,js}')] : [],
        namingStrategy: new CustomNamingStrategy(),
        synchronize: false,
      })
      await dataSource.initialize()
      sources.push(dataSource)
      return dataSource
    },
    async drop() {
      await Promise.allSettled(
        sources.map(async (source) => {
          if (source.isInitialized) await source.destroy()
        })
      )
      await asAdmin(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
    },
  }
}
