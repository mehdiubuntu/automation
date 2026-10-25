import { IGetProjectsPaginateInput } from '@application/project/interface/project.input.interface'
import { ApiProperty } from '@nestjs/swagger'
import { QueryBoolean } from '@presentation/common/decorators/query-boolean.decorator'
import { PaginationQueryDto } from '@presentation/common/dto/pagination-query.dto'
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'

export class GetProjectsPaginateDto extends PaginationQueryDto implements IGetProjectsPaginateInput {
  @ApiProperty({ required: false, description: 'Case-insensitive substring of name or code' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  isActive?: boolean
}
