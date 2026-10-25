import { IGetUsersPaginateInput } from '@application/user/interface/user.input.interface'
import { UserStatus } from '@domain/user/enum/user.enum'
import { ApiProperty } from '@nestjs/swagger'
import { PaginationQueryDto } from '@presentation/common/dto/pagination-query.dto'
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

export class GetUsersPaginateDto extends PaginationQueryDto implements IGetUsersPaginateInput {
  @ApiProperty({ required: false, enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus

  @ApiProperty({ required: false, description: 'Case-insensitive substring of the email' })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  search?: string
}
