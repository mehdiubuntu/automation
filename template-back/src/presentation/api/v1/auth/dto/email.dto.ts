import { IEmailOnlyInput } from '@application/auth/interface/auth.input.interface'
import { ApiProperty } from '@nestjs/swagger'
import { NormalizedEmail } from '@presentation/common/decorators/validators'

/** Body of resend-verification and forgot-password. */
export class EmailDto implements IEmailOnlyInput {
  @ApiProperty({ example: 'user@example.com' })
  @NormalizedEmail()
  email: string
}
