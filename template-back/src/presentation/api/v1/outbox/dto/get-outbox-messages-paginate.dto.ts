import { IGetOutboxMessagesPaginateInput } from '@application/outbox/interface/get-outbox-messages-paginate.input.interface'
import { IBulkRetryOutboxInput } from '@application/outbox/use-case/outbox-monitoring.use-case'
import { OutboxEventType, OutboxStatus } from '@domain/outbox/enum/outbox.enum'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'
import { PaginationQueryDto } from '@presentation/common/dto/pagination-query.dto'

// enableImplicitConversion coerces 'false' to true BEFORE @Transform runs — read the raw value.
const toBoolean = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
  const raw = obj?.[key]
  return raw === 'true' || raw === true ? true : raw === 'false' || raw === false ? false : raw
}

export class GetOutboxMessagesPaginateDto extends PaginationQueryDto implements IGetOutboxMessagesPaginateInput {
  @ApiProperty({ required: false, enum: OutboxStatus })
  @IsEnum(OutboxStatus)
  @IsOptional()
  status?: OutboxStatus

  @ApiProperty({ required: false, enum: OutboxEventType })
  @IsEnum(OutboxEventType)
  @IsOptional()
  eventType?: OutboxEventType

  @ApiProperty({ required: false, description: 'Recipient (email address)' })
  @IsString()
  @IsOptional()
  aggregateId?: string

  @ApiProperty({
    required: false,
    description: 'true = only "retrying" messages: pending AND already attempted at least once. The key queue-health signal.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  retryingOnly?: boolean

  @ApiProperty({ required: false, description: 'Free text across recipient, event type and the recorded error' })
  @IsString()
  @IsOptional()
  search?: string
}

export class BulkRetryOutboxDto implements IBulkRetryOutboxInput {
  @ApiProperty({ type: [String], description: 'Between 1 and 1000 message ids (UUIDs). Ineligible ones are skipped, not failed.' })
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsUUID(undefined, { each: true })
  ids: string[]
}
