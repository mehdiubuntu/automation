import { ICreateExampleItemInput } from '@application/example-item/interface/example-item.input.interface'
import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class CreateExampleItemDto implements ICreateExampleItemInput {
  @ApiProperty({ example: '0198d3b2-4c7e-7a52-9f0e-3d6a1b2c4d5e', description: 'The project that owns the item (must exist and be active)' })
  @IsUUID()
  projectId: string

  @ApiProperty({ example: 'First item', description: 'Unique per project among non-deleted items' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string

  @ApiProperty({ required: false, example: 'What this item is for' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string
}
