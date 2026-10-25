import { IGetExampleItemsPaginateInput } from '@application/example-item/interface/example-item.input.interface'
import { ApiProperty } from '@nestjs/swagger'
import { QueryBoolean } from '@presentation/common/decorators/query-boolean.decorator'
import { PaginationQueryDto } from '@presentation/common/dto/pagination-query.dto'
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator'

export class GetExampleItemsPaginateDto extends PaginationQueryDto implements IGetExampleItemsPaginateInput {
  @ApiProperty({ example: '0198d3b2-4c7e-7a52-9f0e-3d6a1b2c4d5e', description: 'Required: the project whose items are listed' })
  @IsUUID()
  projectId: string

  @ApiProperty({ required: false, description: 'Case-insensitive substring match' })
  @IsOptional()
  @IsString()
  name?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  isActive?: boolean
}
