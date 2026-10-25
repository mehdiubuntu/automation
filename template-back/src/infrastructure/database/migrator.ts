import { CORE_SCHEMA, databaseConfig } from '@infrastructure/config/database/database.config'
import { assertOwnSchemaOnly, EngineRegistry } from '@infrastructure/jobs/engine-registry'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService, ConfigType } from '@nestjs/config'
import { createHash } from 'crypto'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { DataSource, QueryRunner } from 'typeorm'

export interface MigrationFile {
  /** 'core', 'jobs' or an engine id. */
  owner: string
  /** The Postgres schema the file runs in (search_path), created on demand. */
  schema: string
  name: string
  sql: string
  checksum: string
}

const SRC_ROOT = join(__dirname, '..', '..')
const FILE_NAME = /^\d{4}_[a-z0-9_]+\.sql$/
const LOCK_NAME = 'app:migrations'
const LOCK_TIMEOUT_MS = 120_000
const LOCK_POLL_MS = 500
const JOBS_SCHEMA = 'jobs'

interface AppliedRow {
  owner: string
  name: string
  checksum: string
}

function readOwner(owner: string, schema: string, dir: string, isEngine: boolean): MigrationFile[] {
  if (!existsSync(dir)) return []
  const numbers = new Set<string>()
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => {
      if (!FILE_NAME.test(name)) throw new Error(`Migration ${owner}/${name}: file names look like 0001_create_things.sql`)
      if (numbers.has(name.slice(0, 4))) throw new Error(`Migration ${owner}: two files share the number ${name.slice(0, 4)} - renumber one of them`)
      numbers.add(name.slice(0, 4))
      // Line endings are normalised so a Windows checkout and a Linux build agree on the checksum.
      const sql = readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n')
      if (isEngine) {
        try {
          assertOwnSchemaOnly(sql, schema)
        } catch (error) {
          throw new Error(`Migration ${owner}/${name}: ${(error as Error).message}`)
        }
      }
      return { owner, schema, name, sql, checksum: createHash('sha256').update(sql).digest('hex') }
    })
}

/** Core first, then jobs, then the given engines (alphabetically); inside an owner by file name. */
export function discoverMigrations(engineIds: string[], srcRoot = SRC_ROOT): MigrationFile[] {
  return [
    ...readOwner('core', CORE_SCHEMA, join(srcRoot, 'infrastructure', 'database', 'migrations'), false),
    ...readOwner('jobs', JOBS_SCHEMA, join(srcRoot, 'infrastructure', 'jobs', 'migrations'), false),
    ...[...engineIds].sort().flatMap((id) => readOwner(id, id, join(srcRoot, 'engines', id, 'migrations'), true)),
  ]
}

const key = (file: { owner: string; name: string }) => `${file.owner}/${file.name}`

async function readApplied(runner: QueryRunner): Promise<Map<string, string>> {
  const [{ present }] = (await runner.query(`SELECT to_regclass('"${CORE_SCHEMA}"."migration"') IS NOT NULL AS present`)) as Array<{ present: boolean }>
  if (!present) return new Map()
  const rows = (await runner.query(`SELECT owner, name, checksum FROM "${CORE_SCHEMA}"."migration"`)) as AppliedRow[]
  return new Map(rows.map((row) => [key(row), row.checksum]))
}

function assertUnchanged(file: MigrationFile, appliedChecksum: string): void {
  if (appliedChecksum !== file.checksum) {
    throw new Error(`Migration ${key(file)} was changed after it was applied. Never edit a migration - add a new numbered file instead.`)
  }
}

/** The migrations that still have to run. Does not lock or change anything. */
export async function pendingMigrations(dataSource: DataSource, files: MigrationFile[]): Promise<string[]> {
  const runner = dataSource.createQueryRunner()
  try {
    const applied = await readApplied(runner)
    return files.filter((file) => !applied.has(key(file))).map(key)
  } finally {
    await runner.release()
  }
}

async function acquireLock(runner: QueryRunner): Promise<void> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS
  for (;;) {
    const [{ locked }] = (await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [LOCK_NAME])) as Array<{ locked: boolean }>
    if (locked) return
    if (Date.now() > deadline) throw new Error('Gave up waiting for another process to finish applying migrations')
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS))
  }
}

/**
 * Applies every pending file, each in its own transaction, while holding a Postgres advisory lock: when the API and
 * the worker boot together, one migrates and the others wait, then find nothing left to do. Returns what it applied.
 */
export async function applyMigrations(dataSource: DataSource, files: MigrationFile[], log: (message: string) => void = () => undefined): Promise<string[]> {
  const runner = dataSource.createQueryRunner()
  const applied: string[] = []
  try {
    await runner.connect()
    await acquireLock(runner)
    try {
      await runner.query(`CREATE SCHEMA IF NOT EXISTS "${CORE_SCHEMA}"`)
      await runner.query(
        `CREATE TABLE IF NOT EXISTS "${CORE_SCHEMA}"."migration" (owner text NOT NULL, name text NOT NULL, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (owner, name))`
      )
      const done = await readApplied(runner)
      for (const file of files) {
        const appliedChecksum = done.get(key(file))
        if (appliedChecksum !== undefined) {
          assertUnchanged(file, appliedChecksum)
          continue
        }
        await runner.startTransaction()
        try {
          await runner.query(`CREATE SCHEMA IF NOT EXISTS "${file.schema}"`)
          await runner.query(`SET LOCAL search_path TO "${file.schema}"`)
          await runner.query(file.sql)
          await runner.query(`INSERT INTO "${CORE_SCHEMA}"."migration" (owner, name, checksum) VALUES ($1, $2, $3)`, [file.owner, file.name, file.checksum])
          await runner.commitTransaction()
        } catch (error) {
          await runner.rollbackTransaction()
          throw new Error(`Migration ${key(file)} failed: ${(error as Error).message}`, { cause: error })
        }
        applied.push(key(file))
        log(`applied ${key(file)}`)
      }
    } finally {
      await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME])
    }
  } finally {
    await runner.release()
  }
  return applied
}

/** Applies pending migrations at boot (DB_AUTO_MIGRATE=true). With auto-migrate off, a database that is behind the code stops the boot. */
@Injectable()
export class Migrator implements OnModuleInit {
  private readonly logger = new Logger(Migrator.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly engines: EngineRegistry
  ) {}

  async onModuleInit(): Promise<void> {
    const files = discoverMigrations(this.engines.enabledIds())
    if (this.config.getOrThrow<ConfigType<typeof databaseConfig>>('DatabaseConfig').autoMigrate) {
      const applied = await applyMigrations(this.dataSource, files, (message) => this.logger.log(message))
      this.logger.log(applied.length > 0 ? `${applied.length} migration(s) applied` : 'database is up to date')
      return
    }
    const pending = await pendingMigrations(this.dataSource, files)
    if (pending.length > 0) {
      throw new Error(`DB_AUTO_MIGRATE=false and ${pending.length} migration(s) are pending (${pending.join(', ')}). Run "npm run migration:run" first.`)
    }
  }
}
