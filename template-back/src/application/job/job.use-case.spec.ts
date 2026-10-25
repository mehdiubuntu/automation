import { InMemoryProjectRepository } from '@application/project/testing/in-memory-project.repository'
import { fakeId } from '@application/shared/testing/fake-id'
import { JobUseCase } from '@application/job/job.use-case'
import { AuthUser } from '@domain/auth/type/auth-user.type'
import { IEngineCatalog, IJobQueue, INewJob, JobInputCheck, JobRun, JobStatus } from '@domain/job/job.contract'
import { Project } from '@domain/project/aggregate/project.aggregate'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'

class InMemoryJobQueue implements IJobQueue {
  rows: JobRun[] = []
  enqueued: INewJob[] = []

  enqueue(job: INewJob) {
    this.enqueued.push(job)
    const existing = job.idempotencyKey ? this.rows.find((row) => row.type === job.type && (row as JobRun & { key?: string }).key === job.idempotencyKey) : undefined
    if (existing) return Promise.resolve({ job: existing, created: false })
    const created = {
      id: fakeId(this.rows.length + 1),
      engine: job.engine,
      type: job.type,
      projectId: job.projectId,
      requestedBy: job.requestedBy,
      input: job.input,
      status: JobStatus.QUEUED,
      attempts: 0,
      maxAttempts: job.maxAttempts,
      progress: null,
      progressNote: null,
      result: null,
      error: null,
      cancelRequested: false,
      correlationId: job.correlationId ?? null,
      runAt: new Date(),
      createdAt: new Date(),
      startedAt: null,
      finishedAt: null,
      key: job.idempotencyKey,
    } as JobRun
    this.rows.push(created)
    return Promise.resolve({ job: created, created: true })
  }

  findById(id: string) {
    return Promise.resolve(this.rows.find((row) => row.id === id) ?? null)
  }

  list(): Promise<IPaginatedResponse<JobRun>> {
    return Promise.resolve({ data: this.rows, meta: { itemsPerPage: 10, totalItems: this.rows.length, currentPage: 1, totalPages: 1 } })
  }

  cancel(id: string) {
    const row = this.rows.find((candidate) => candidate.id === id)
    if (!row || row.status === JobStatus.SUCCEEDED) return Promise.resolve(null)
    if (row.status === JobStatus.QUEUED) row.status = JobStatus.CANCELLED
    else row.cancelRequested = true
    return Promise.resolve(row)
  }
}

class FakeCatalog implements IEngineCatalog {
  describe(type: string) {
    return type === 'audit.run' ? { engine: 'audit', maxAttempts: 2 } : undefined
  }

  validateInput(_type: string, input: unknown): Promise<JobInputCheck> {
    const url = (input as { url?: unknown } | null)?.url
    return Promise.resolve(typeof url === 'string' ? { ok: true, value: { url: url.trim() } } : { ok: false, errors: ['url must be a string'] })
  }
}

const actor: AuthUser = { userId: fakeId(900), email: 'ada@example.test', role: UserRole.SPARTAN, status: UserStatus.ACTIVE, sessionId: 's-1' }

describe('JobUseCase', () => {
  let queue: InMemoryJobQueue
  let projects: InMemoryProjectRepository
  let useCase: JobUseCase
  let project: Project

  beforeEach(async () => {
    queue = new InMemoryJobQueue()
    projects = new InMemoryProjectRepository()
    useCase = new JobUseCase(queue, new FakeCatalog(), projects)
    project = await projects.insertOne(Project.create({ name: 'Alpha', code: 'ALPHA', isActive: true }))
  })

  it('queues a job with the engine, attempts, requester and the cleaned input', async () => {
    const job = await useCase.startJob(actor, { type: 'audit.run', projectId: project.id!, input: { url: ' https://example.com ' } }, 'corr-1')

    expect(job).toMatchObject({
      engine: 'audit',
      type: 'audit.run',
      status: JobStatus.QUEUED,
      maxAttempts: 2,
      requestedBy: actor.userId,
      input: { url: 'https://example.com' },
      correlationId: 'corr-1',
    })
    expect(queue.enqueued).toHaveLength(1)
  })

  it('returns the first job for a repeated idempotency key', async () => {
    const input = { type: 'audit.run', projectId: project.id!, input: { url: 'https://example.com' }, idempotencyKey: 'once' }

    const first = await useCase.startJob(actor, input)
    const again = await useCase.startJob(actor, input)

    expect(again.id).toBe(first.id)
    expect(queue.rows).toHaveLength(1)
  })

  it('refuses an unknown or disabled job type (400 JOB_001)', async () => {
    await expect(useCase.startJob(actor, { type: 'seo.nothing', projectId: project.id!, input: {} })).rejects.toMatchObject({ status: 400, errorCode: 'JOB_001' })
    expect(queue.enqueued).toHaveLength(0)
  })

  it('refuses an input the engine rejects (400 JOB_003)', async () => {
    await expect(useCase.startJob(actor, { type: 'audit.run', projectId: project.id!, input: { url: 5 } })).rejects.toMatchObject({ status: 400, errorCode: 'JOB_003' })
    expect(queue.enqueued).toHaveLength(0)
  })

  it('requires the project to exist (404) and to be active (409)', async () => {
    await expect(useCase.startJob(actor, { type: 'audit.run', projectId: fakeId(404), input: { url: 'https://example.com' } })).rejects.toMatchObject({
      status: 404,
      errorCode: 'PROJECT_001',
    })

    await projects.updateById(project.id!, Project.create({ isActive: false }))
    await expect(useCase.startJob(actor, { type: 'audit.run', projectId: project.id!, input: { url: 'https://example.com' } })).rejects.toMatchObject({
      status: 409,
      errorCode: 'PROJECT_005',
    })
    expect(queue.enqueued).toHaveLength(0)
  })

  it('reads one job, lists jobs, and answers 404 JOB_002 for an unknown id', async () => {
    const job = await useCase.startJob(actor, { type: 'audit.run', projectId: project.id!, input: { url: 'https://example.com' } })

    expect(await useCase.getJobById(job.id)).toBe(job)
    expect((await useCase.getJobs({})).data).toHaveLength(1)
    await expect(useCase.getJobById(fakeId(999))).rejects.toMatchObject({ status: 404, errorCode: 'JOB_002' })
  })

  it('cancels a queued job, and answers 409 JOB_004 when the job already finished', async () => {
    const job = await useCase.startJob(actor, { type: 'audit.run', projectId: project.id!, input: { url: 'https://example.com' } })

    expect((await useCase.cancelJob(job.id)).status).toBe(JobStatus.CANCELLED)

    queue.rows[0].status = JobStatus.SUCCEEDED
    await expect(useCase.cancelJob(job.id)).rejects.toMatchObject({ status: 409, errorCode: 'JOB_004' })
    await expect(useCase.cancelJob(fakeId(999))).rejects.toMatchObject({ status: 404, errorCode: 'JOB_002' })
  })
})
