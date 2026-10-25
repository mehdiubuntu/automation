import { INewJob, JobRun, JobStatus } from '@domain/job/job.contract'
import { ENGINES } from '@engines/index'
import { defineEngine, defineJob, EngineContext, EngineError } from '@engines/sdk'
import { applyMigrations, discoverMigrations } from '@infrastructure/database/migrator'
import { createTestDatabase, describeWithDatabase, TestDatabase } from '@infrastructure/database/testing/test-database'
import { EngineContextFactory } from '@infrastructure/jobs/engine-context'
import { EngineRegistry } from '@infrastructure/jobs/engine-registry'
import { PgJobQueue } from '@infrastructure/jobs/job-queue'
import { JobWorker } from '@infrastructure/jobs/job-worker'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { IsOptional, IsString } from 'class-validator'
import { DataSource } from 'typeorm'
import { addTransactionalDataSource, initializeTransactionalContext } from 'typeorm-transactional'
import { TypeOrmUnitOfWork } from '@infrastructure/database/shared/unit-of-work/unit-of-work.service'

class ValueInput {
  @IsOptional()
  @IsString()
  value?: string
}

const never = () => new Promise<never>(() => undefined)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const testEngines = defineEngine({
  id: 'tw',
  concurrency: 2,
  jobs: {
    'tw.ok': defineJob({
      input: ValueInput,
      retries: 1,
      handler: (ctx: EngineContext, input: ValueInput) => {
        ctx.progress(50, 'half way')
        return Promise.resolve({ echoed: input.value, attempt: ctx.attempt })
      },
    }),
    'tw.boom': defineJob({ input: ValueInput, retries: 1, handler: () => Promise.reject(new Error('boom')) }),
    'tw.fatal': defineJob({ input: ValueInput, retries: 3, handler: () => Promise.reject(new EngineError('bad input', false)) }),
    // Never settles and ignores its signal: only the runner's own timeout can end it.
    'tw.hang': defineJob({ input: ValueInput, retries: 0, timeoutMs: 1000, handler: never }),
    'tw.cancellable': defineJob({
      input: ValueInput,
      retries: 0,
      handler: (ctx: EngineContext) => new Promise<never>((_resolve, reject) => ctx.signal.addEventListener('abort', () => reject(ctx.signal.reason as Error))),
    }),
    'tw.slow': defineJob({ input: ValueInput, retries: 2, handler: () => sleep(3000).then(() => ({ done: true })) }),
  },
})

async function waitFor(check: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('timed out waiting for the condition')
    await sleep(50)
  }
}

describeWithDatabase('job queue and worker (real PostgreSQL)', () => {
  jest.setTimeout(60_000)
  let db: TestDatabase
  let dataSource: DataSource
  let queue: PgJobQueue
  let projectId: string
  let userId: string
  let engineSeq = 0
  const stoppers: Array<() => Promise<void>> = []

  const newJob = async (overrides: Partial<INewJob> = {}): Promise<JobRun> =>
    (await queue.enqueue({ engine: 'q', type: 'q.run', projectId, requestedBy: userId, input: {}, maxAttempts: 3, ...overrides })).job
  const row = async (id: string) => (await dataSource.query<Array<Record<string, unknown>>>('SELECT * FROM jobs.job_run WHERE id = $1', [id]))[0]
  const freshEngine = () => `q${++engineSeq}`

  beforeAll(async () => {
    Logger.overrideLogger(false)
    db = await createTestDatabase()
    dataSource = await db.connect()
    await applyMigrations(dataSource, discoverMigrations(ENGINES.map((engine) => engine.id)))
    queue = new PgJobQueue(dataSource)
    projectId = (await dataSource.query<Array<{ id: string }>>(`INSERT INTO platform."Project" (name, code) VALUES ('Alpha', 'ALPHA') RETURNING id`))[0].id
    userId = (
      await dataSource.query<Array<{ id: string }>>(`INSERT INTO platform."User" (email, password, role, status) VALUES ('ada@example.test', 'hash', 1, 1) RETURNING id`)
    )[0].id
  })
  afterAll(async () => {
    await Promise.allSettled(stoppers.map((stop) => stop()))
    await db.drop()
    Logger.overrideLogger(['log', 'error', 'warn'])
  })

  describe('queue', () => {
    it('stores a queued job and returns the first one again for a repeated idempotency key', async () => {
      const first = await queue.enqueue({
        engine: 'q',
        type: 'q.run',
        projectId,
        requestedBy: userId,
        input: { a: 1 },
        maxAttempts: 3,
        idempotencyKey: 'k-1',
        correlationId: 'corr-1',
      })
      const again = await queue.enqueue({ engine: 'q', type: 'q.run', projectId, requestedBy: userId, input: { a: 2 }, maxAttempts: 3, idempotencyKey: 'k-1' })

      expect(first.created).toBe(true)
      expect(first.job).toMatchObject({ status: JobStatus.QUEUED, attempts: 0, maxAttempts: 3, input: { a: 1 }, correlationId: 'corr-1', requestedBy: userId })
      expect(again).toEqual({ job: first.job, created: false })
    })

    it('claims due jobs of one engine, oldest first, and reserves them with a lease', async () => {
      const engine = freshEngine()
      const first = await newJob({ engine, type: `${engine}.run` })
      const second = await newJob({ engine, type: `${engine}.run` })
      const later = await newJob({ engine, type: `${engine}.run` })
      await dataSource.query(`UPDATE jobs.job_run SET run_at = now() + interval '1 hour' WHERE id = $1`, [later.id])
      await newJob({ engine: `${engine}-other`, type: `${engine}-other.run` })

      const claimed = await queue.claim(engine, 5, 'worker-a', 60)

      expect(claimed.map((job) => job.id)).toEqual([first.id, second.id])
      expect(claimed[0]).toMatchObject({ status: JobStatus.RUNNING, attempts: 1 })
      expect(claimed[0].startedAt).not.toBeNull()
      expect(await queue.claim(engine, 5, 'worker-b', 60)).toEqual([])
    })

    it('hands every job to exactly one of two workers claiming at the same moment', async () => {
      const engine = freshEngine()
      for (let i = 0; i < 12; i++) await newJob({ engine, type: `${engine}.run` })

      const [a, b] = await Promise.all([queue.claim(engine, 8, 'worker-a', 60), queue.claim(engine, 8, 'worker-b', 60)])
      const ids = [...a, ...b].map((job) => job.id)

      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.length).toBe(12)
    })

    it('extends the lease only for the owner and reports a cancel request', async () => {
      const engine = freshEngine()
      const job = await newJob({ engine, type: `${engine}.run` })
      await queue.claim(engine, 1, 'worker-a', 60)

      expect(await queue.heartbeat(job.id, 'worker-a', 120)).toEqual({ owned: true, cancelRequested: false })
      expect(await queue.heartbeat(job.id, 'someone-else', 120)).toEqual({ owned: false, cancelRequested: false })
      await queue.cancel(job.id)
      expect(await queue.heartbeat(job.id, 'worker-a', 120)).toEqual({ owned: true, cancelRequested: true })
    })

    it('lets only the lease holder finish a job', async () => {
      const engine = freshEngine()
      const job = await newJob({ engine, type: `${engine}.run` })
      await queue.claim(engine, 1, 'worker-a', 60)

      expect(await queue.succeed(job.id, 'someone-else', { ok: false })).toBe(false)
      expect(await queue.succeed(job.id, 'worker-a', { ok: true })).toBe(true)

      expect(await queue.findById(job.id)).toMatchObject({ status: JobStatus.SUCCEEDED, result: { ok: true }, progress: 100, error: null })
      expect((await row(job.id)).locked_by).toBeNull()
    })

    it('retries with a delay while attempts remain, then fails for good', async () => {
      const engine = freshEngine()
      const job = await newJob({ engine, type: `${engine}.run`, maxAttempts: 2 })

      await queue.claim(engine, 1, 'worker-a', 60)
      expect(await queue.failOrRetry(job.id, 'worker-a', { message: 'first', retryable: true, backoffMs: 60_000 })).toBe(JobStatus.QUEUED)
      const waiting = (await queue.findById(job.id))!
      expect(waiting).toMatchObject({ status: JobStatus.QUEUED, attempts: 1, error: 'first', finishedAt: null })
      expect(waiting.runAt.getTime()).toBeGreaterThan(Date.now() + 30_000)
      expect(await queue.claim(engine, 1, 'worker-a', 60)).toEqual([])

      await dataSource.query(`UPDATE jobs.job_run SET run_at = now() WHERE id = $1`, [job.id])
      await queue.claim(engine, 1, 'worker-a', 60)
      expect(await queue.failOrRetry(job.id, 'worker-a', { message: 'second', retryable: true, backoffMs: 0 })).toBe(JobStatus.FAILED)
      expect(await queue.findById(job.id)).toMatchObject({ status: JobStatus.FAILED, attempts: 2, error: 'second' })
    })

    it('fails at once when the failure is not retryable', async () => {
      const engine = freshEngine()
      const job = await newJob({ engine, type: `${engine}.run`, maxAttempts: 5 })
      await queue.claim(engine, 1, 'worker-a', 60)

      expect(await queue.failOrRetry(job.id, 'worker-a', { message: 'nope', retryable: false, backoffMs: 0 })).toBe(JobStatus.FAILED)
    })

    it('cancels a queued job at once, asks a running one to stop, and refuses a finished one', async () => {
      const engine = freshEngine()
      const queued = await newJob({ engine, type: `${engine}.run` })
      const running = await newJob({ engine, type: `${engine}.run` })
      await queue.claim(engine, 5, 'worker-a', 60)
      const waiting = await newJob({ engine, type: `${engine}.run` })

      expect((await queue.cancel(waiting.id))!.status).toBe(JobStatus.CANCELLED)
      expect((await queue.cancel(running.id))!).toMatchObject({ status: JobStatus.RUNNING, cancelRequested: true })
      await queue.succeed(queued.id, 'worker-a', null)
      expect(await queue.cancel(queued.id)).toBeNull()
      expect(await queue.cancel('00000000-0000-7000-8000-000000000000')).toBeNull()
    })

    it('recovers jobs whose lease ran out: requeued, or failed when no attempts are left', async () => {
      const engine = freshEngine()
      const retryable = await newJob({ engine, type: `${engine}.run`, maxAttempts: 3 })
      const exhausted = await newJob({ engine, type: `${engine}.run`, maxAttempts: 1 })
      await queue.claim(engine, 5, 'dead-worker', 60)
      await dataSource.query(`UPDATE jobs.job_run SET locked_until = now() - interval '1 minute' WHERE engine = $1`, [engine])

      expect(await queue.recoverExpired()).toBe(2)

      expect(await queue.findById(retryable.id)).toMatchObject({ status: JobStatus.QUEUED, attempts: 1 })
      expect(await queue.findById(exhausted.id)).toMatchObject({ status: JobStatus.FAILED, error: 'The worker stopped responding (its lease expired).' })
    })

    it("hands a worker's unfinished jobs back without charging an attempt", async () => {
      const engine = freshEngine()
      const job = await newJob({ engine, type: `${engine}.run` })
      await queue.claim(engine, 1, 'worker-leaving', 60)

      expect(await queue.releaseAll('worker-leaving')).toBe(1)

      expect(await queue.findById(job.id)).toMatchObject({ status: JobStatus.QUEUED, attempts: 0 })
    })

    it('purges only old finished jobs and lists with filters and pages', async () => {
      const engine = freshEngine()
      const old = await newJob({ engine, type: `${engine}.run` })
      const fresh = await newJob({ engine, type: `${engine}.run` })
      await queue.claim(engine, 2, 'worker-a', 60)
      await queue.succeed(old.id, 'worker-a', 1)
      await queue.succeed(fresh.id, 'worker-a', 1)
      await dataSource.query(`UPDATE jobs.job_run SET finished_at = now() - interval '40 days' WHERE id = $1`, [old.id])

      expect(await queue.purgeFinished(30)).toBeGreaterThanOrEqual(1)
      expect(await queue.findById(old.id)).toBeNull()
      expect(await queue.findById(fresh.id)).not.toBeNull()

      const page = await queue.list({ engine, status: JobStatus.SUCCEEDED, projectId, limit: 1, page: 1 })
      expect(page.data.map((job) => job.id)).toEqual([fresh.id])
      expect(page.meta).toEqual({ itemsPerPage: 1, totalItems: 1, currentPage: 1, totalPages: 1 })
    })
  })

  describe('worker', () => {
    function startWorker(grace = 1) {
      const url = new URL(process.env.TEST_DATABASE_URL as string)
      const config = new ConfigService({
        JobsConfig: { enabledEngines: '*', workerEngines: [], pollIntervalMs: 50, leaseSeconds: 3, retentionDays: 30, shutdownGraceSeconds: grace },
        DatabaseConfig: {
          host: url.hostname,
          port: Number(url.port) || 5432,
          username: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password),
          database: db.name,
        },
      })
      const contexts = new EngineContextFactory(config)
      const worker = new JobWorker(config, new EngineRegistry([testEngines]), queue, contexts)
      worker.onApplicationBootstrap()
      const stop = async () => {
        await worker.beforeApplicationShutdown()
        await contexts.onApplicationShutdown()
      }
      stoppers.push(stop)
      return { worker, stop }
    }
    const enqueue = (type: string, input: unknown = {}, maxAttempts = 2) => newJob({ engine: 'tw', type, input, maxAttempts })
    const statusOf = async (id: string) => (await queue.findById(id))!.status

    it('runs a job, stores its result and releases the lease', async () => {
      const { stop } = startWorker()
      const job = await enqueue('tw.ok', { value: 'hi' })

      await waitFor(async () => (await statusOf(job.id)) === JobStatus.SUCCEEDED)

      expect(await queue.findById(job.id)).toMatchObject({ result: { echoed: 'hi', attempt: 1 }, attempts: 1, progress: 100, error: null })
      expect((await row(job.id)).locked_by).toBeNull()
      await stop()
    })

    it('puts a failing job back in the queue with a backoff while attempts remain', async () => {
      const { stop } = startWorker()
      const job = await enqueue('tw.boom')

      await waitFor(async () => (await queue.findById(job.id))!.error === 'boom')

      const after = (await queue.findById(job.id))!
      expect(after).toMatchObject({ status: JobStatus.QUEUED, attempts: 1 })
      expect(after.runAt.getTime()).toBeGreaterThan(Date.now() + 20_000)
      await stop()
    })

    it('fails for good when the engine marks the failure as not retryable', async () => {
      const { stop } = startWorker()
      const job = await enqueue('tw.fatal', {}, 4)

      await waitFor(async () => (await statusOf(job.id)) === JobStatus.FAILED)

      expect(await queue.findById(job.id)).toMatchObject({ attempts: 1, error: 'bad input' })
      await stop()
    })

    it('ends a handler that ignores its abort signal once the job times out', async () => {
      const { stop } = startWorker()
      const job = await enqueue('tw.hang', {}, 1)

      await waitFor(async () => (await statusOf(job.id)) === JobStatus.FAILED, 8000)

      expect((await queue.findById(job.id))!.error).toBe('Timed out after 1000 ms')
      await stop()
    })

    it('stops a running job when it is cancelled', async () => {
      const { stop } = startWorker()
      const job = await enqueue('tw.cancellable', {}, 1)
      await waitFor(async () => (await statusOf(job.id)) === JobStatus.RUNNING)

      await queue.cancel(job.id)
      await waitFor(async () => (await statusOf(job.id)) === JobStatus.CANCELLED, 8000)

      expect((await row(job.id)).locked_by).toBeNull()
      await stop()
    })

    it('takes over a job whose worker died', async () => {
      const job = await enqueue('tw.ok', { value: 'rescued' }, 3)
      await dataSource.query(
        `UPDATE jobs.job_run SET status = 'running', attempts = 1, locked_by = 'dead-worker', locked_until = now() - interval '1 minute', started_at = now() WHERE id = $1`,
        [job.id]
      )
      const { stop } = startWorker()

      await waitFor(async () => (await statusOf(job.id)) === JobStatus.SUCCEEDED)

      expect(await queue.findById(job.id)).toMatchObject({ attempts: 2, result: { echoed: 'rescued', attempt: 2 } })
      await stop()
    })

    it('hands a job it could not finish back to the queue on shutdown', async () => {
      const { stop } = startWorker(1)
      const job = await enqueue('tw.slow', {}, 3)
      await waitFor(async () => (await statusOf(job.id)) === JobStatus.RUNNING)

      await stop()

      expect(await queue.findById(job.id)).toMatchObject({ status: JobStatus.QUEUED, attempts: 0 })
      await sleep(3200)
    })
  })

  describe('unit of work', () => {
    // The point of keeping the queue in Postgres: "approve" and "queue the publish job" commit or fail together.
    it('rolls an enqueued job back with the business write, and commits both together', async () => {
      initializeTransactionalContext()
      const transactional = addTransactionalDataSource(await db.connect())
      const uow = new TypeOrmUnitOfWork()
      const txQueue = new PgJobQueue(transactional)
      const count = async (key: string) =>
        (await dataSource.query<Array<{ n: number }>>('SELECT count(*)::int AS n FROM jobs.job_run WHERE idempotency_key = $1', [key]))[0].n

      await expect(
        uow.execute(async () => {
          await txQueue.enqueue({ engine: 'q', type: 'q.run', projectId, requestedBy: userId, input: {}, maxAttempts: 1, idempotencyKey: 'uow-rollback' })
          throw new Error('the business operation failed')
        })
      ).rejects.toThrow('the business operation failed')
      expect(await count('uow-rollback')).toBe(0)

      await uow.execute(async () => {
        await txQueue.enqueue({ engine: 'q', type: 'q.run', projectId, requestedBy: userId, input: {}, maxAttempts: 1, idempotencyKey: 'uow-commit' })
      })
      expect(await count('uow-commit')).toBe(1)
    })
  })

  describe('engine context', () => {
    const job = (): JobRun =>
      ({
        id: '00000000-0000-7000-8000-0000000000bb',
        engine: 'audit',
        type: 'audit.run',
        projectId: '00000000-0000-7000-8000-0000000000aa',
        attempts: 1,
        correlationId: null,
      }) as JobRun

    function context(report: (percent: number, note: string | null) => Promise<void> = () => Promise.resolve()) {
      const url = new URL(process.env.TEST_DATABASE_URL as string)
      const factory = new EngineContextFactory(
        new ConfigService({
          DatabaseConfig: {
            host: url.hostname,
            port: Number(url.port) || 5432,
            username: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: db.name,
          },
        })
      )
      stoppers.push(() => factory.onApplicationShutdown())
      return factory.create(job(), new AbortController().signal, report)
    }

    it("reads and writes the engine's own schema with unqualified names, and rolls a transaction back on error", async () => {
      const ctx = context()

      await ctx.db.query(`INSERT INTO audit_run (project_id, job_id, url, score, findings) VALUES ($1, $2, 'https://a.test', 90, '[]')`, [ctx.projectId, ctx.jobId])
      expect(await ctx.db.query('SELECT score FROM audit_run WHERE job_id = $1', [ctx.jobId])).toEqual([{ score: 90 }])

      await expect(
        ctx.db.tx(async (tx) => {
          await tx.query(`UPDATE audit_run SET score = 1 WHERE job_id = $1`, [ctx.jobId])
          throw new Error('abort the transaction')
        })
      ).rejects.toThrow('abort the transaction')
      expect(await ctx.db.query('SELECT score FROM audit_run WHERE job_id = $1', [ctx.jobId])).toEqual([{ score: 90 }])
    })

    it('refuses SQL that reaches into another schema', async () => {
      const ctx = context()

      await expect(ctx.db.query('SELECT * FROM platform."User"')).rejects.toThrow('may only use its own schema')
      await expect(ctx.db.query('SELECT * FROM jobs.job_run')).rejects.toThrow('may only use its own schema')
      await expect(ctx.db.query('SET search_path TO platform')).rejects.toThrow('not allowed')
    })

    it('saves only the newest progress value, at most about once a second', async () => {
      const saved: Array<[number, string | null]> = []
      const ctx = context((percent, note) => (saved.push([percent, note]), Promise.resolve()))

      ctx.progress(10, 'a')
      ctx.progress(40, 'b')
      ctx.progress(70, 'c')
      await sleep(1300)

      expect(saved.at(-1)).toEqual([70, 'c'])
      expect(saved.length).toBeLessThanOrEqual(2)
    })
  })
})
