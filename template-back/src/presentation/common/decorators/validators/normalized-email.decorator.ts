import { EMAIL_MAX_LENGTH, normalizeEmail } from '@domain/user/util/email.util'
import { applyDecorators } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsEmail, IsString, MaxLength } from 'class-validator'

/** An email property: trimmed and lower-cased before validation, a valid address, at most 254 characters. */
export function NormalizedEmail() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }): unknown => (typeof value === 'string' ? normalizeEmail(value) : value)),
    IsString(),
    MaxLength(EMAIL_MAX_LENGTH),
    IsEmail()
  )
}
