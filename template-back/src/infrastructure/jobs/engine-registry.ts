import { IEngineCatalog, JobInputCheck } from '@domain/job/job.contract'
import { ENGINES } from '@engines/index'
import { EngineDefinition, RegisteredJob, validateJobInput } from '@engines/sdk'
import { JobsConfigType } from '@infrastructure/config/jobs/jobs.config'
import { ConfigService } from '@nestjs/config'
import { Provider } from '@nestjs/common'

const ENGINE_ID = /^[a-z][a-z0-9_]{1,30}$/
const JOB_NAME = /^[a-z0-9_.-]{1,60}$/
const RESERVED_SCHEMAS = ['platform', 'jobs', 'public', 'pgboss', 'information_schema', 'pg_catalog', 'pg_toast', 'postgres']

const DEFAULT_TIMEOUT_MS = 300_000
const MAX_TIMEOUT_MS = 3_600_000
const DEFAULT_RETRIES = 2
const MAX_RETRIES = 10
const DEFAULT_CONCURRENCY = 2
const MAX_CONCURRENCY = 20

export interface LoadedJob {
  engine: string
  type: string
  input: new () => object
  handler: RegisteredJob['handler']
  timeoutMs: number
  maxAttempts: number
}

const inRange = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max

/** Picks the engines ENGINES_ENABLED switches on; an id that no engine has fails boot with the list of known ids. */
export function resolveEnabledEngines(setting: '*' | string[], known: EngineDefinition[] = ENGINES): EngineDefinition[] {
  if (setting === '*') return known
  const byId = new Map(known.map((engine) => [engine.id, engine]))
  return [...new Set(setting)].map((id) => {
    const engine = byId.get(id)
    if (!engine) throw new Error(`ENGINES_ENABLED lists "${id}" but src/engines/index.ts has no such engine (known: ${known.map((e) => e.id).join(', ') || 'none'})`)
    return engine
  })
}

const stripSqlComments = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
const FORBIDDEN_SQL =
  /\b(search_path|set\s+(session\s+)?role|create\s+(schema|role|extension|database)|alter\s+(schema|role|database|system)|drop\s+(schema|role|database))\b/i

/**
 * Accident guard for engine SQL (migrations and runtime queries): refuses statements that leave the engine's own schema.
 * It reads the text, so it stops mistakes - the schema is not a security boundary against hostile code.
 */
export function assertOwnSchemaOnly(sql: string, schema: string, otherSchemas: string[] = ENGINES.map((engine) => engine.id)): void {
  const text = stripSqlComments(sql)
  const statement = FORBIDDEN_SQL.exec(text)
  if (statement) throw new Error(`"${statement[0].trim()}" is not allowed in engine SQL`)
  const others = [...RESERVED_SCHEMAS, ...otherSchemas].filter((name) => name !== schema)
  const reference = new RegExp(`(?:^|[^\\w$])"?(${others.join('|')})"?\\s*\\.`, 'i').exec(text)
  if (reference) throw new Error(`engine SQL may only use its own schema "${schema}", but it references "${reference[1]}"`)
}

/** The enabled engines and their job types. Validates every definition at construction, so a bad engine stops the boot. */
export class EngineRegistry implements IEngineCatalog {
  private readonly byId = new Map<string, EngineDefinition>()
  private readonly byType = new Map<string, LoadedJob>()

  constructor(engines: EngineDefinition[]) {
    for (const engine of engines) this.add(engine)
  }

  enabledIds(): string[] {
    return [...this.byId.keys()]
  }

  /** The engines one worker process runs: WORKER_ENGINES when given (it must be a subset of the enabled ones), otherwise all enabled. */
  workerEngineIds(requested: string[]): string[] {
    if (requested.length === 0) return this.enabledIds()
    const unknown = requested.filter((id) => !this.byId.has(id))
    if (unknown.length > 0) throw new Error(`WORKER_ENGINES lists ${unknown.join(', ')}, which ${unknown.length > 1 ? 'are' : 'is'} not enabled by ENGINES_ENABLED`)
    return requested
  }

  concurrencyOf(engineId: string): number {
    return this.byId.get(engineId)?.concurrency ?? DEFAULT_CONCURRENCY
  }

  job(type: string): LoadedJob | undefined {
    return this.byType.get(type)
  }

  describe(type: string) {
    const job = this.byType.get(type)
    return job ? { engine: job.engine, maxAttempts: job.maxAttempts } : undefined
  }

  async validateInput(type: string, input: unknown): Promise<JobInputCheck> {
    const job = this.byType.get(type)
    if (!job) return { ok: false, errors: [`unknown job type "${type}"`] }
    return validateJobInput(job.input, input)
  }

  private add(engine: EngineDefinition): void {
    const where = `Engine "${engine.id}"`
    if (!ENGINE_ID.test(engine.id) || RESERVED_SCHEMAS.includes(engine.id) || engine.id.startsWith('pg_')) {
      throw new Error(`${where}: the id must be 2-31 lower-case letters, digits or underscores, start with a letter, and not be a reserved schema name`)
    }
    if (this.byId.has(engine.id)) throw new Error(`${where} is registered twice`)
    const concurrency = engine.concurrency ?? DEFAULT_CONCURRENCY
    if (!inRange(concurrency, 1, MAX_CONCURRENCY)) throw new Error(`${where}: concurrency must be an integer from 1 to ${MAX_CONCURRENCY}`)
    const types = Object.keys(engine.jobs)
    if (types.length === 0) throw new Error(`${where} declares no jobs`)

    for (const type of types) {
      const job = engine.jobs[type]
      if (!type.startsWith(`${engine.id}.`) || !JOB_NAME.test(type.slice(engine.id.length + 1))) {
        throw new Error(`${where}: job type "${type}" must look like "${engine.id}.<name>" (lower-case letters, digits, . _ -)`)
      }
      if (this.byType.has(type)) throw new Error(`Job type "${type}" is declared by two engines`)
      if (typeof job.input !== 'function' || typeof job.handler !== 'function') throw new Error(`${where}: job "${type}" needs an input class and a handler`)
      const timeoutMs = job.timeoutMs ?? DEFAULT_TIMEOUT_MS
      const retries = job.retries ?? DEFAULT_RETRIES
      if (!inRange(timeoutMs, 1000, MAX_TIMEOUT_MS)) throw new Error(`${where}: job "${type}" timeoutMs must be an integer from 1000 to ${MAX_TIMEOUT_MS}`)
      if (!inRange(retries, 0, MAX_RETRIES)) throw new Error(`${where}: job "${type}" retries must be an integer from 0 to ${MAX_RETRIES}`)
      this.byType.set(type, { engine: engine.id, type, input: job.input, handler: job.handler, timeoutMs, maxAttempts: retries + 1 })
    }
    this.byId.set(engine.id, { ...engine, concurrency })
  }
}

/** Same registry for the API and the worker: the enabled engines per ENGINES_ENABLED. */
export const engineRegistryProvider: Provider = {
  provide: EngineRegistry,
  useFactory: (config: ConfigService) => new EngineRegistry(resolveEnabledEngines(config.getOrThrow<JobsConfigType>('JobsConfig').enabledEngines)),
  inject: [ConfigService],
}
