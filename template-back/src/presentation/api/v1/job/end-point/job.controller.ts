import { JobUseCase } from '@application/job/job.use-case'
import type { AuthUser } from '@domain/auth/type/auth-user.type'
import { UserRole } from '@domain/user/enum/user.enum'
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { GetJobsDto, RunJobDto } from '@presentation/api/v1/job/dto/job.dto'
import { AsyncContextService } from '@presentation/common/context/async-context.service'
import { CurrentUser } from '@presentation/common/decorators/current-user.decorator'
import { Roles } from '@presentation/common/decorators/roles.decorator'
import { IdDto } from '@presentation/common/dto/id.dto'
import { AuthGuard } from '@presentation/common/guards/auth.guard'
import { RolesGuard } from '@presentation/common/guards/roles.guard'

/** One generic surface for every engine: engine developers write no controllers. Open to SPARTAN and SUPERADMIN. */
@ApiTags('Job')
@Controller('v1/job')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.SPARTAN, UserRole.SUPERADMIN)
export class JobEndPoint {
  constructor(
    private readonly jobUseCase: JobUseCase,
    private readonly context: AsyncContextService
  ) {}

  @ApiOperation({
    summary: 'Start a background job',
    description: 'Answers at once with the queued job. Poll get-job/:id for progress and the result. A repeated idempotencyKey returns the first job.',
  })
  @Post('run-job')
  async runJob(@Body() dto: RunJobDto, @CurrentUser() user: AuthUser) {
    return await this.jobUseCase.startJob(user, dto, this.context.getCorrelationId())
  }

  @ApiOperation({ summary: 'List jobs (paginated), newest first' })
  @Get('get-jobs')
  async getJobs(@Query() dto: GetJobsDto) {
    return await this.jobUseCase.getJobs(dto)
  }

  @ApiOperation({ summary: 'Get a job: status, progress, result or error' })
  @Get('get-job/:id')
  async getJob(@Param() params: IdDto) {
    return await this.jobUseCase.getJobById(params.id)
  }

  @ApiOperation({ summary: 'Cancel a job', description: 'A queued job is cancelled at once; a running one is asked to stop and ends as cancelled.' })
  @Post('cancel-job/:id')
  @HttpCode(HttpStatus.OK)
  async cancelJob(@Param() params: IdDto) {
    return await this.jobUseCase.cancelJob(params.id)
  }
}
