import { IJobListQuery, IJobQueue, INewJob, JobRun, JobStatus } from '@domain/job/job.contract'
import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'
import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100
const ERROR_MAX_CHARS = 2000

interface JobRow {
  id: string
  engine: string
  type: string
  project_id: string
  requested_by: string | null
  input: unknown
  status: JobStatus
  attempts: number
  max_attempts: number
  progress: number | null
  progress_note: string | null
  result: unknown
  error: string | null
  cancel_requested: boolean
  correlation_id: string | null
  run_at: Date
  created_at: Date
  started_at: Date | null
  finished_at: Date | null
}

const COLUMNS =
  'id, engine, type, project_id, requested_by, input, status, attempts, max_attempts, progress, progress_note, result, error, cancel_requested, correlation_id, run_at, created_at, started_at, finished_at'

const toJobRun = (row: JobRow): JobRun => ({
  id: row.id,
  engine: row.engine,
  type: row.type,
  projectId: row.project_id,
  requestedBy: row.requested_by,
  input: row.input,
  status: row.status,
  attempts: row.attempts,
  maxAttempts: row.max_attempts,
  progress: row.progress,
  progressNote: row.progress_note,
  result: row.result,
  error: row.error,
  cancelRequested: row.cancel_requested,
  correlationId: row.correlation_id,
  runAt: row.run_at,
  createdAt: row.created_at,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
})

export interface FailureOutcome {
  message: string
  /** False = fail for good even when attempts remain. */
  retryable: boolean
  /** How long a retry waits before it may start. */
  backoffMs: number
}

/**
 * The job queue and its history in one table (jobs.job_run). The API side is the IJobQueue port; the worker side
 * (claim, heartbeat, finish, recover) is used by JobWorker directly. Every worker write is guarded by `locked_by`, so a
 * worker that lost its lease can never overwrite the job that another worker took over.
 */
@Injectable()
export class PgJobQueue implements IJobQueue {
  constructor(private readonly dataSource: DataSource) {}

  // ---- API side -----------------------------------------------------------------------------------------------

  async enqueue(job: INewJob): Promise<{ job: JobRun; created: boolean }> {
    const { rows } = await this.exec(
      `INSERT INTO jobs.job_run (engine, type, project_id, requested_by, input, max_attempts, idempotency_key, correlation_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       ON CONFLICT (type, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING ${COLUMNS}`,
      [job.engine, job.type, job.projectId, job.requestedBy, JSON.stringify(job.input), job.maxAttempts, job.idempotencyKey ?? null, job.correlationId ?? null]
    )
    if (rows.length > 0) return { job: toJobRun(rows[0]), created: true }
    const existing = await this.exec(`SELECT ${COLUMNS} FROM jobs.job_run WHERE type = $1 AND idempotency_key = $2`, [job.type, job.idempotencyKey])
    return { job: toJobRun(existing.rows[0]), created: false }
  }

  async findById(id: string): Promise<JobRun | null> {
    const { rows } = await this.exec(`SELECT ${COLUMNS} FROM jobs.job_run WHERE id = $1`, [id])
    return rows.length > 0 ? toJobRun(rows[0]) : null
  }

  async list(query: IJobListQuery): Promise<IPaginatedResponse<JobRun>> {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, MAX_LIMIT) : DEFAULT_LIMIT
    const direction = query.order === OrderDirectionEnum.ASC ? 'ASC' : 'DESC'
    const filter = 'WHERE ($1::uuid IS NULL OR project_id = $1) AND ($2::text IS NULL OR engine = $2) AND ($3::text IS NULL OR status = $3)'
    const params = [query.projectId ?? null, query.engine ?? null, query.status ?? null]

    const total = await this.exec<{ total: number }>(`SELECT count(*)::int AS total FROM jobs.job_run ${filter}`, params)
    const { rows } = await this.exec(`SELECT ${COLUMNS} FROM jobs.job_run ${filter} ORDER BY created_at ${direction}, id ${direction} LIMIT $4 OFFSET $5`, [
      ...params,
      limit,
      (page - 1) * limit,
    ])
    const totalItems = total.rows[0].total
    return { data: rows.map(toJobRun), meta: { itemsPerPage: limit, totalItems, currentPage: page, totalPages: Math.ceil(totalItems / limit) } }
  }

  async cancel(id: string): Promise<JobRun | null> {
    const queued = await this.exec(
      `UPDATE jobs.job_run SET status = 'cancelled', finished_at = now(), locked_by = NULL, locked_until = NULL
       WHERE id = $1 AND status = 'queued' RETURNING ${COLUMNS}`,
      [id]
    )
    if (queued.rows.length > 0) return toJobRun(queued.rows[0])
    const running = await this.exec(`UPDATE jobs.job_run SET cancel_requested = true WHERE id = $1 AND status = 'running' RETURNING ${COLUMNS}`, [id])
    return running.rows.length > 0 ? toJobRun(running.rows[0]) : null
  }

  // ---- Worker side --------------------------------------------------------------------------------------------

  /** Reserves up to `limit` due jobs of one engine for this worker. SKIP LOCKED lets several workers claim side by side without waiting. */
  async claim(engine: string, limit: number, workerId: string, leaseSeconds: number): Promise<JobRun[]> {
    const { rows } = await this.exec(
      `UPDATE jobs.job_run j
       SET status = 'running', attempts = j.attempts + 1, locked_by = $2, locked_until = now() + ($3::int * interval '1 second'), started_at = COALESCE(j.started_at, now())
       WHERE j.id IN (
         SELECT id FROM jobs.job_run WHERE engine = $1 AND status = 'queued' AND run_at <= now()
         ORDER BY run_at, id FOR UPDATE SKIP LOCKED LIMIT $4
       )
       RETURNING ${COLUMNS.split(', ')
         .map((column) => `j.${column}`)
         .join(', ')}`,
      [engine, workerId, leaseSeconds, limit]
    )
    return rows.map(toJobRun).sort((a, b) => a.runAt.getTime() - b.runAt.getTime() || a.id.localeCompare(b.id))
  }

  /** Extends the lease. `owned: false` means the job is no longer ours (lease lost): the worker must stop and write nothing. */
  async heartbeat(id: string, workerId: string, leaseSeconds: number): Promise<{ owned: boolean; cancelRequested: boolean }> {
    const { rows } = await this.exec(
      `UPDATE jobs.job_run SET locked_until = now() + ($3::int * interval '1 second')
       WHERE id = $1 AND locked_by = $2 AND status = 'running' RETURNING cancel_requested`,
      [id, workerId, leaseSeconds]
    )
    return { owned: rows.length > 0, cancelRequested: rows[0]?.cancel_requested ?? false }
  }

  async setProgress(id: string, workerId: string, percent: number, note: string | null): Promise<void> {
    await this.exec(`UPDATE jobs.job_run SET progress = $3, progress_note = $4 WHERE id = $1 AND locked_by = $2 AND status = 'running'`, [id, workerId, percent, note])
  }

  async succeed(id: string, workerId: string, result: unknown): Promise<boolean> {
    const { count } = await this.exec(
      `UPDATE jobs.job_run SET status = 'succeeded', result = $3::jsonb, error = NULL, progress = 100, locked_by = NULL, locked_until = NULL, finished_at = now()
       WHERE id = $1 AND locked_by = $2 AND status = 'running'`,
      [id, workerId, JSON.stringify(result ?? null)]
    )
    return count > 0
  }

  /** Back to the queue with a delay while attempts remain and the failure is retryable; otherwise failed for good. Returns the new status. */
  async failOrRetry(id: string, workerId: string, outcome: FailureOutcome): Promise<JobStatus | null> {
    const { rows } = await this.exec<{ status: JobStatus }>(
      `UPDATE jobs.job_run SET
         status = CASE WHEN $3::boolean AND attempts < max_attempts THEN 'queued' ELSE 'failed' END,
         error = $4,
         run_at = CASE WHEN $3::boolean AND attempts < max_attempts THEN now() + ($5::int * interval '1 millisecond') ELSE run_at END,
         finished_at = CASE WHEN $3::boolean AND attempts < max_attempts THEN NULL ELSE now() END,
         progress = CASE WHEN $3::boolean AND attempts < max_attempts THEN NULL ELSE progress END,
         locked_by = NULL, locked_until = NULL
       WHERE id = $1 AND locked_by = $2 AND status = 'running'
       RETURNING status`,
      [id, workerId, outcome.retryable, outcome.message.slice(0, ERROR_MAX_CHARS), Math.round(outcome.backoffMs)]
    )
    return rows[0]?.status ?? null
  }

  async markCancelled(id: string, workerId: string): Promise<void> {
    await this.exec(
      `UPDATE jobs.job_run SET status = 'cancelled', finished_at = now(), locked_by = NULL, locked_until = NULL
       WHERE id = $1 AND locked_by = $2 AND status = 'running'`,
      [id, workerId]
    )
  }

  /** Graceful shutdown: hand this worker's jobs back at once, without charging them an attempt. */
  async releaseAll(workerId: string): Promise<number> {
    const { count } = await this.exec(
      `UPDATE jobs.job_run SET
         status = CASE WHEN cancel_requested THEN 'cancelled' ELSE 'queued' END,
         attempts = GREATEST(attempts - 1, 0), run_at = now(),
         finished_at = CASE WHEN cancel_requested THEN now() END,
         locked_by = NULL, locked_until = NULL
       WHERE locked_by = $1 AND status = 'running'`,
      [workerId]
    )
    return count
  }

  /** Jobs whose lease ran out (the worker died or hung) go back to the queue, or fail when no attempts are left. Safe to run from every worker. */
  async recoverExpired(): Promise<number> {
    const { count } = await this.exec(
      `UPDATE jobs.job_run SET
         status = CASE WHEN cancel_requested THEN 'cancelled' WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
         error = 'The worker stopped responding (its lease expired).',
         run_at = now(),
         finished_at = CASE WHEN cancel_requested OR attempts >= max_attempts THEN now() END,
         locked_by = NULL, locked_until = NULL
       WHERE status = 'running' AND locked_until < now()`
    )
    return count
  }

  async purgeFinished(retentionDays: number): Promise<number> {
    const { count } = await this.exec(
      `DELETE FROM jobs.job_run WHERE status IN ('succeeded', 'failed', 'cancelled') AND finished_at < now() - ($1::int * interval '1 day')`,
      [retentionDays]
    )
    return count
  }

  // The entity manager (not dataSource.query) so a surrounding unit of work carries the statement too.
  private async exec<T = JobRow>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; count: number }> {
    const raw: unknown = await this.dataSource.manager.query(sql, params)
    // TypeORM answers UPDATE/DELETE with [rows, affectedCount] and every other statement with the rows themselves.
    if (Array.isArray(raw) && raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number') return { rows: raw[0] as T[], count: raw[1] }
    const rows = raw as T[]
    return { rows, count: rows.length }
  }
}
