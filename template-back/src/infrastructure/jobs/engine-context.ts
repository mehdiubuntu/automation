import { JobRun } from '@domain/job/job.contract'
import { EngineContext, EngineDb, EngineQuery } from '@engines/sdk'
import { databaseConfig } from '@infrastructure/config/database/database.config'
import { createEngineHttp } from '@infrastructure/jobs/engine-http'
import { assertOwnSchemaOnly } from '@infrastructure/jobs/engine-registry'
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService, ConfigType } from '@nestjs/config'
import { DataSource } from 'typeorm'

const POOL_SIZE = 3
const STATEMENT_TIMEOUT_MS = 60_000
const PROGRESS_EVERY_MS = 1000

export type ProgressReporter = (percent: number, note: string | null) => Promise<void>

/** TypeORM answers UPDATE/DELETE with [rows, affectedCount]; an engine just wants the rows. */
function rowsOf<T>(raw: unknown): T[] {
  return Array.isArray(raw) && raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number' ? (raw[0] as T[]) : (raw as T[])
}

/** An engine's database access: its own small connection pool whose sessions start in the engine's schema, with a statement timeout. */
class EngineSourceDb implements EngineDb {
  constructor(
    private readonly ready: Promise<DataSource>,
    private readonly schema: string
  ) {}

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    assertOwnSchemaOnly(sql, this.schema)
    const source = await this.ready
    return rowsOf<T>(await source.query(sql, params))
  }

  async tx<T>(work: (tx: EngineQuery) => Promise<T>): Promise<T> {
    const runner = (await this.ready).createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      const result = await work({
        query: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          assertOwnSchemaOnly(sql, this.schema)
          return rowsOf<R>(await runner.query(sql, params))
        },
      })
      await runner.commitTransaction()
      return result
    } catch (error) {
      await runner.rollbackTransaction().catch(() => undefined)
      throw error
    } finally {
      await runner.release()
    }
  }
}

/** Builds the toolbox (ctx) an engine handler receives for one job. The engine gets nothing else from the application. */
@Injectable()
export class EngineContextFactory implements OnApplicationShutdown {
  private readonly logger = new Logger(EngineContextFactory.name)
  private readonly sources = new Map<string, Promise<DataSource>>()

  constructor(private readonly config: ConfigService) {}

  create(job: JobRun, signal: AbortSignal, report: ProgressReporter): EngineContext {
    const log = new Logger(`engine:${job.engine}`)
    const line = (message: string, data?: Record<string, unknown>) =>
      `[job ${job.id}${job.correlationId ? ` ${job.correlationId}` : ''}] ${message}${data ? ` ${JSON.stringify(data)}` : ''}`

    // Progress is throttled to one write a second; the newest value always wins.
    let lastSent = 0
    let pending: { percent: number; note: string | null } | undefined
    let timer: NodeJS.Timeout | undefined
    const flush = () => {
      timer = undefined
      const next = pending
      pending = undefined
      if (!next) return
      lastSent = Date.now()
      report(next.percent, next.note).catch((error: Error) => log.warn(line(`progress not saved: ${error.message}`)))
    }

    return {
      jobId: job.id,
      jobType: job.type,
      projectId: job.projectId,
      attempt: job.attempts,
      signal,
      log: {
        info: (message, data) => log.log(line(message, data)),
        warn: (message, data) => log.warn(line(message, data)),
        error: (message, data) => log.error(line(message, data)),
      },
      http: createEngineHttp(signal),
      db: this.dbFor(job.engine),
      progress: (percent, note) => {
        pending = { percent: Math.min(100, Math.max(0, Math.round(percent))), note: note ?? null }
        if (timer || signal.aborted) return
        timer = setTimeout(flush, Math.max(0, lastSent + PROGRESS_EVERY_MS - Date.now()))
      },
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([...this.sources.values()].map(async (ready) => (await ready).destroy()))
  }

  private dbFor(engine: string): EngineDb {
    let ready = this.sources.get(engine)
    if (!ready) {
      const db = this.config.getOrThrow<ConfigType<typeof databaseConfig>>('DatabaseConfig')
      ready = new DataSource({
        type: 'postgres',
        host: db.host,
        port: db.port,
        username: db.username,
        password: db.password,
        database: db.database,
        poolSize: POOL_SIZE,
        extra: { options: `-c search_path=${engine} -c statement_timeout=${STATEMENT_TIMEOUT_MS} -c idle_in_transaction_session_timeout=${STATEMENT_TIMEOUT_MS}` },
      }).initialize()
      // A failed start must not poison the next job: forget it so the next call tries again.
      ready.catch((error: Error) => {
        this.logger.error(`engine ${engine}: database connection failed: ${error.message}`)
        this.sources.delete(engine)
      })
      this.sources.set(engine, ready)
    }
    return new EngineSourceDb(ready, engine)
  }
}
