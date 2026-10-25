import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { Type } from 'class-transformer'
import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator'

export class BasePaginationQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number
  @IsOptional()
  @IsEnum(OrderDirectionEnum)
  order?: OrderDirectionEnum
}
