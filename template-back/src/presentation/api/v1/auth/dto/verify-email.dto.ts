import { IVerifyEmailInput } from '@application/auth/interface/auth.input.interface'
import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches } from 'class-validator'
import { NormalizedEmail } from '@presentation/common/decorators/validators'

export class VerifyEmailDto implements IVerifyEmailInput {
  @ApiProperty({ example: 'user@example.com' })
  @NormalizedEmail()
  email: string

  @ApiProperty({ example: '123456', description: '6-digit code sent by email' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits.' })
  code: string
}
