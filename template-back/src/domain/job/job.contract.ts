import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'

export enum JobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/** A job as the API and the UI see it. A failed attempt that will be retried is `queued` again with attempts > 0 and a later runAt. */
export interface JobRun {
  id: string
  engine: string
  type: string
  projectId: string
  requestedBy: string | null
  input: unknown
  status: JobStatus
  attempts: number
  maxAttempts: number
  progress: number | null
  progressNote: string | null
  result: unknown
  error: string | null
  cancelRequested: boolean
  correlationId: string | null
  runAt: Date
  createdAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}

export interface INewJob {
  engine: string
  type: string
  projectId: string
  requestedBy: string | null
  input: unknown
  maxAttempts: number
  /** A repeated key for the same job type returns the first job instead of creating another. */
  idempotencyKey?: string
  correlationId?: string
}

export interface IJobListQuery {
  projectId?: string
  engine?: string
  status?: JobStatus
  page?: number
  limit?: number
  order?: OrderDirectionEnum
}

export const JOB_QUEUE_TOKEN = Symbol('JOB_QUEUE_TOKEN')

/** The API side of the queue. Workers use the concrete queue class directly. Enqueueing joins the caller's unit of work when there is one. */
export interface IJobQueue {
  enqueue(job: INewJob): Promise<{ job: JobRun; created: boolean }>
  findById(id: string): Promise<JobRun | null>
  list(query: IJobListQuery): Promise<IPaginatedResponse<JobRun>>
  /** queued -> cancelled at once; running -> the worker is asked to stop. Null when the job is already finished (or unknown). */
  cancel(id: string): Promise<JobRun | null>
}

export const ENGINE_CATALOG_TOKEN = Symbol('ENGINE_CATALOG_TOKEN')

export type JobInputCheck = { ok: true; value: unknown } | { ok: false; errors: string[] }

/** What the enabled engines can run. */
export interface IEngineCatalog {
  /** Undefined when no enabled engine handles this job type. */
  describe(type: string): { engine: string; maxAttempts: number } | undefined
  /** Validates the input against the engine's declared input class and returns the cleaned value. */
  validateInput(type: string, input: unknown): Promise<JobInputCheck>
}
