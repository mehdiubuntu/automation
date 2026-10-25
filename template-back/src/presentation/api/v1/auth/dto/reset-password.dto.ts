import { IResetPasswordInput } from '@application/auth/interface/auth.input.interface'
import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches } from 'class-validator'
import { IsSecurePassword, NormalizedEmail } from '@presentation/common/decorators/validators'

export class ResetPasswordDto implements IResetPasswordInput {
  @ApiProperty({ example: 'user@example.com' })
  @NormalizedEmail()
  email: string

  @ApiProperty({ example: '123456', description: '6-digit code sent by email' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits.' })
  code: string

  @ApiProperty({ example: 'NewP@ssw0rd!', description: 'Same policy as registration' })
  @IsSecurePassword()
  newPassword: string
}
