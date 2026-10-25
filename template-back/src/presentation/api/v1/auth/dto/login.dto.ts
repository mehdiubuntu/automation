import { ILoginInput } from '@application/auth/interface/auth.input.interface'
import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { NormalizedEmail } from '@presentation/common/decorators/validators'

// Login deliberately has no password policy: it must accept whatever was set, and answer wrong ones generically.
export class LoginDto implements ILoginInput {
  @ApiProperty({ example: 'user@example.com' })
  @NormalizedEmail()
  email: string

  @ApiProperty({ example: 'P@ssw0rd!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password: string
}
