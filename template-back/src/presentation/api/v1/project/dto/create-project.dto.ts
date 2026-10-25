import { ICreateProjectInput } from '@application/project/interface/project.input.interface'
import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class CreateProjectDto implements ICreateProjectInput {
  @ApiProperty({ example: 'Website redesign', description: 'Unique among non-deleted projects' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string

  @ApiProperty({ required: false, example: 'WEB-REDESIGN', description: 'Uppercase slug, immutable. Derived from the name when omitted.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/, { message: 'Code may contain letters, digits, spaces, dashes and underscores.' })
  code?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string
}
