import { IGetAuthEventsPaginateInput } from '@application/user/interface/user.input.interface'
import { AuthEventType } from '@domain/auth-event/enum/auth-event.enum'
import { ApiProperty } from '@nestjs/swagger'
import { PaginationQueryDto } from '@presentation/common/dto/pagination-query.dto'
import { IsEnum, IsOptional, IsUUID } from 'class-validator'

export class GetAuthEventsPaginateDto extends PaginationQueryDto implements IGetAuthEventsPaginateInput {
  @ApiProperty({ required: false, example: '0198d3b2-4c7e-7a52-9f0e-3d6a1b2c4d5e' })
  @IsOptional()
  @IsUUID()
  userId?: string

  @ApiProperty({ required: false, enum: AuthEventType })
  @IsOptional()
  @IsEnum(AuthEventType)
  type?: AuthEventType
}
