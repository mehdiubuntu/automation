import { IChangePasswordInput } from '@application/auth/interface/auth.input.interface'
import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { IsSecurePassword } from '@presentation/common/decorators/validators'

export class ChangePasswordDto implements IChangePasswordInput {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  currentPassword: string

  @ApiProperty({ description: 'Same policy as registration; must differ from the current password' })
  @IsSecurePassword()
  newPassword: string
}
