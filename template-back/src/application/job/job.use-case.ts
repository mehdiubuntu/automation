import { AuthUser } from '@domain/auth/type/auth-user.type'
import { ENGINE_CATALOG_TOKEN, type IEngineCatalog, type IJobListQuery, type IJobQueue, JOB_QUEUE_TOKEN, JobRun } from '@domain/job/job.contract'
import { PROJECT_REPOSITORY_TOKEN, type IProjectRepository } from '@domain/project/repository/project.repository'
import { GenericException } from '@domain/shared/error/base-http.exception'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'
import { Inject, Injectable } from '@nestjs/common'

export interface IStartJobInput {
  type: string
  projectId: string
  input: unknown
  idempotencyKey?: string
}

export type IGetJobsInput = IJobListQuery

/**
 * Starts, reads and cancels background jobs. It knows nothing about engines beyond the catalog port: it checks that the job
 * type is enabled, the input is valid and the project is usable, then queues the job for a worker. Every active user may run
 * any enabled job on any project (no per-project membership), so the only access rule is the controller's role check.
 */
@Injectable()
export class JobUseCase {
  constructor(
    @Inject(JOB_QUEUE_TOKEN)
    private readonly queue: IJobQueue,
    @Inject(ENGINE_CATALOG_TOKEN)
    private readonly catalog: IEngineCatalog,
    @Inject(PROJECT_REPOSITORY_TOKEN)
    private readonly projectRepository: IProjectRepository
  ) {}

  async startJob(actor: AuthUser, input: IStartJobInput, correlationId?: string): Promise<JobRun> {
    const spec = this.catalog.describe(input.type)
    if (!spec) {
      throw new GenericException('Unknown or disabled job type.', 400, 'JOB', 'JOB_001')
    }
    await this.assertProjectUsable(input.projectId)
    const checked = await this.catalog.validateInput(input.type, input.input)
    if (!checked.ok) {
      throw new GenericException(`Invalid job input: ${checked.errors.join('; ')}`, 400, 'JOB', 'JOB_003')
    }
    const { job } = await this.queue.enqueue({
      engine: spec.engine,
      type: input.type,
      projectId: input.projectId,
      requestedBy: actor.userId,
      input: checked.value,
      maxAttempts: spec.maxAttempts,
      idempotencyKey: input.idempotencyKey,
      correlationId,
    })
    return job
  }

  getJobs(query: IGetJobsInput): Promise<IPaginatedResponse<JobRun>> {
    return this.queue.list(query)
  }

  async getJobById(id: string): Promise<JobRun> {
    const job = await this.queue.findById(id)
    if (!job) {
      throw new GenericException('Job not found.', 404, 'JOB', 'JOB_002')
    }
    return job
  }

  async cancelJob(id: string): Promise<JobRun> {
    await this.getJobById(id)
    const cancelled = await this.queue.cancel(id)
    if (!cancelled) {
      throw new GenericException('The job has already finished.', 409, 'JOB', 'JOB_004')
    }
    return cancelled
  }

  private async assertProjectUsable(projectId: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId)
    if (!project) {
      throw new GenericException('Project not found.', 404, 'PROJECT', 'PROJECT_001')
    }
    if (!project.isActive) {
      throw new GenericException('The project is not active.', 409, 'PROJECT', 'PROJECT_005')
    }
  }
}
