import { IGetJobsInput, IStartJobInput } from '@application/job/job.use-case'
import { JobStatus } from '@domain/job/job.contract'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@presentation/common/dto/pagination-query.dto'
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator'

export class RunJobDto implements IStartJobInput {
  @ApiProperty({ example: 'audit.run', description: '<engine>.<name> of an enabled engine job' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*\.[a-z0-9_.-]{1,60}$/, { message: 'type must look like "engine.job-name".' })
  type: string

  @ApiProperty({ example: '0198d3b2-4c7e-7a52-9f0e-3d6a1b2c4d5e', description: 'The project the job works on (must exist and be active)' })
  @IsUUID()
  projectId: string

  @ApiProperty({ example: { url: 'https://example.com' }, description: "The job's input, validated against the engine's input class" })
  @IsObject()
  input: Record<string, unknown>

  @ApiPropertyOptional({ description: 'Sending the same key for the same job type again returns the first job instead of queueing another' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string
}

export class GetJobsDto extends PaginationQueryDto implements IGetJobsInput {
  @ApiPropertyOptional({ example: '0198d3b2-4c7e-7a52-9f0e-3d6a1b2c4d5e' })
  @IsOptional()
  @IsUUID()
  projectId?: string

  @ApiPropertyOptional({ example: 'audit' })
  @IsOptional()
  @IsString()
  @MaxLength(31)
  engine?: string

  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus
}
