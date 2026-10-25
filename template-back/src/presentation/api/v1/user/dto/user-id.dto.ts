import { ApiProperty } from '@nestjs/swagger'
import { IsUUID } from 'class-validator'

export class UserIdDto {
  @ApiProperty({ example: '0198d3b2-4c7e-7a52-9f0e-3d6a1b2c4d5e' })
  @IsUUID()
  userId: string
}
