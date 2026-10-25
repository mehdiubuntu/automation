import { ApiProperty } from '@nestjs/swagger'
import { IsUUID } from 'class-validator'

export class SessionIdDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string
}
