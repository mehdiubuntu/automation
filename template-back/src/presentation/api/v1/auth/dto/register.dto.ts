import { IRegisterInput } from '@application/auth/interface/auth.input.interface'
import { ApiProperty } from '@nestjs/swagger'
import { IsSecurePassword, NormalizedEmail } from '@presentation/common/decorators/validators'

export class RegisterDto implements IRegisterInput {
  @ApiProperty({ example: 'user@example.com', description: 'Trimmed and lower-cased server-side' })
  @NormalizedEmail()
  email: string

  @ApiProperty({ example: 'P@ssw0rd!', description: '8+ characters (72 bytes max), with lowercase, uppercase, a digit and a special character' })
  @IsSecurePassword()
  password: string
}
