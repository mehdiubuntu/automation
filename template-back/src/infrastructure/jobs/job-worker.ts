import { JobRun, JobStatus } from '@domain/job/job.contract'
import { EngineError, validateJobInput } from '@engines/sdk'
import { JobsConfigType } from '@infrastructure/config/jobs/jobs.config'
import { EngineContextFactory } from '@infrastructure/jobs/engine-context'
import { EngineRegistry, LoadedJob } from '@infrastructure/jobs/engine-registry'
import { PgJobQueue } from '@infrastructure/jobs/job-queue'
import { BeforeApplicationShutdown, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'
import { hostname } from 'os'

const RECOVER_EVERY_MS = 15_000
const PURGE_EVERY_MS = 60 * 60 * 1000
const MIN_HEARTBEAT_MS = 1000
const MAX_RESULT_CHARS = 1_000_000
const BACKOFF_BASE_MS = 30_000
const BACKOFF_MAX_MS = 600_000

type AbortKind = 'cancelled' | 'timeout' | 'lease_lost'

/** The reason a job's AbortSignal carries, so the runner knows why a handler was stopped. */
class JobAbort extends Error {
  constructor(readonly kind: AbortKind) {
    super(kind)
  }
}

/** 30 s, 60 s, 120 s ... capped at 10 min. */
export const backoffMs = (attempt: number): number => Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1), BACKOFF_MAX_MS)

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** Settles with the handler, or rejects as soon as the signal aborts - an engine that ignores the signal cannot wedge a worker slot. */
function raceAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason)))
    if (signal.aborted) return onAbort()
    signal.addEventListener('abort', onAbort, { once: true })
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

/**
 * The background half of the app. Polls the queue for the engines this process runs, executes each job with a context,
 * a timeout, a lease that heartbeats while it works, and retries with backoff. Engine code only ever sees its ctx.
 */
@Injectable()
export class JobWorker implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(JobWorker.name)
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`
  private readonly settings: JobsConfigType
  private readonly engineIds: string[]
  private readonly running = new Map<string, number>()
  private readonly active = new Set<Promise<void>>()
  private stopping = false
  private loop: Promise<void> | undefined
  private wake: (() => void) | undefined

  constructor(
    config: ConfigService,
    private readonly registry: EngineRegistry,
    private readonly queue: PgJobQueue,
    private readonly contexts: EngineContextFactory
  ) {
    this.settings = config.getOrThrow<JobsConfigType>('JobsConfig')
    this.engineIds = registry.workerEngineIds(this.settings.workerEngines)
  }

  onApplicationBootstrap(): void {
    if (this.engineIds.length === 0) {
      this.logger.warn('No engine is enabled (ENGINES_ENABLED) - this worker has nothing to run')
      return
    }
    this.logger.log(`worker ${this.workerId} running: ${this.engineIds.map((id) => `${id} x${this.registry.concurrencyOf(id)}`).join(', ')}`)
    this.loop = this.run()
  }

  /** Runs before the database connections close: stop claiming, let running jobs finish (up to the grace period), hand back the rest. */
  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true
    this.wake?.()
    await this.loop
    await this.drain()
    const released = await this.queue.releaseAll(this.workerId).catch(() => 0)
    if (released > 0) this.logger.log(`handed ${released} unfinished job(s) back to the queue`)
  }

  private async run(): Promise<void> {
    let lastRecover = 0
    let lastPurge = 0
    while (!this.stopping) {
      try {
        const now = Date.now()
        if (now - lastRecover >= RECOVER_EVERY_MS) {
          lastRecover = now
          const recovered = await this.queue.recoverExpired()
          if (recovered > 0) this.logger.warn(`recovered ${recovered} job(s) whose worker stopped responding`)
        }
        if (now - lastPurge >= PURGE_EVERY_MS) {
          lastPurge = now
          await this.queue.purgeFinished(this.settings.retentionDays)
        }
        for (const engine of this.engineIds) {
          const free = this.registry.concurrencyOf(engine) - (this.running.get(engine) ?? 0)
          if (free <= 0 || this.stopping) continue
          for (const job of await this.queue.claim(engine, free, this.workerId, this.settings.leaseSeconds)) this.launch(job)
        }
      } catch (error) {
        this.logger.error(`polling failed: ${errorMessage(error)}`)
      }
      await this.pause(this.settings.pollIntervalMs)
    }
  }

  private launch(job: JobRun): void {
    this.running.set(job.engine, (this.running.get(job.engine) ?? 0) + 1)
    const task: Promise<void> = this.execute(job)
      .catch((error) => this.logger.error(`job ${job.id} could not be run: ${errorMessage(error)}`))
      .finally(() => {
        this.running.set(job.engine, (this.running.get(job.engine) ?? 1) - 1)
        this.active.delete(task)
      })
    this.active.add(task)
  }

  private async execute(job: JobRun): Promise<void> {
    const spec = this.registry.job(job.type)
    if (!spec) {
      await this.queue.failOrRetry(job.id, this.workerId, { message: `No enabled engine handles "${job.type}"`, retryable: false, backoffMs: 0 })
      return
    }

    const controller = new AbortController()
    const heartbeat = setInterval(() => void this.beat(job, controller), Math.max(MIN_HEARTBEAT_MS, Math.floor((this.settings.leaseSeconds * 1000) / 3)))
    const deadline = setTimeout(() => controller.abort(new JobAbort('timeout')), spec.timeoutMs)
    this.logger.log(`job ${job.id} ${job.type} started (attempt ${job.attempts}/${job.maxAttempts})`)
    try {
      const checked = await validateJobInput(spec.input, job.input)
      if (!checked.ok) throw new EngineError(`The stored input is no longer valid for this engine: ${checked.errors.join('; ')}`, false)
      const context = this.contexts.create(job, controller.signal, (percent, note) => this.queue.setProgress(job.id, this.workerId, percent, note))
      const result = await raceAbort(spec.handler(context, checked.value as never), controller.signal)
      if (JSON.stringify(result ?? null).length > MAX_RESULT_CHARS) {
        throw new EngineError("The result is larger than 1 MB - keep large data in the engine's own tables and return a summary", false)
      }
      if (await this.queue.succeed(job.id, this.workerId, result)) this.logger.log(`job ${job.id} succeeded`)
      else this.logger.warn(`job ${job.id} finished after its lease was lost; the result was dropped`)
    } catch (error) {
      await this.fail(job, spec, error, controller.signal)
    } finally {
      clearInterval(heartbeat)
      clearTimeout(deadline)
    }
  }

  private async fail(job: JobRun, spec: LoadedJob, error: unknown, signal: AbortSignal): Promise<void> {
    const kind = signal.aborted && signal.reason instanceof JobAbort ? signal.reason.kind : undefined
    if (kind === 'lease_lost') {
      this.logger.warn(`job ${job.id} was taken over by another worker; stopping without writing anything`)
      return
    }
    if (kind === 'cancelled') {
      await this.queue.markCancelled(job.id, this.workerId)
      this.logger.log(`job ${job.id} cancelled`)
      return
    }
    const timedOut = kind === 'timeout'
    const message = timedOut ? `Timed out after ${spec.timeoutMs} ms` : errorMessage(error)
    const retryable = timedOut || !(error instanceof EngineError) || error.retryable
    const delay = backoffMs(job.attempts)
    const status = await this.queue.failOrRetry(job.id, this.workerId, { message, retryable, backoffMs: delay })
    this.logger.warn(`job ${job.id} failed${status === JobStatus.QUEUED ? `, retrying in ${Math.round(delay / 1000)} s` : ' for good'}: ${message}`)
  }

  private async beat(job: JobRun, controller: AbortController): Promise<void> {
    try {
      const state = await this.queue.heartbeat(job.id, this.workerId, this.settings.leaseSeconds)
      if (!state.owned) controller.abort(new JobAbort('lease_lost'))
      else if (state.cancelRequested) controller.abort(new JobAbort('cancelled'))
    } catch (error) {
      this.logger.warn(`job ${job.id} heartbeat failed: ${errorMessage(error)}`)
    }
  }

  private pause(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer)
        this.wake = undefined
        resolve()
      }
      const timer = setTimeout(done, ms)
      this.wake = done
    })
  }

  private async drain(): Promise<void> {
    if (this.active.size === 0) return
    let timer: NodeJS.Timeout | undefined
    const grace = new Promise<void>((resolve) => (timer = setTimeout(resolve, this.settings.shutdownGraceSeconds * 1000)))
    await Promise.race([Promise.allSettled([...this.active]), grace])
    clearTimeout(timer)
  }
}
