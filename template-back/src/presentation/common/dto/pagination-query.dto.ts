import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator'

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number

  @ApiPropertyOptional({
    enum: OrderDirectionEnum,
    default: OrderDirectionEnum.DESC,
  })
  @IsOptional()
  @IsEnum(OrderDirectionEnum)
  order?: OrderDirectionEnum
}
