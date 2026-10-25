import { ValidationArguments } from 'class-validator'
import { PASSWORD_MAX_BYTES } from '@domain/auth/policy/password.policy'
import { IsSecurePasswordConstraint } from '@presentation/common/decorators/validators/is-secure-password.validator'

describe('IsSecurePasswordConstraint', () => {
  const constraint = new IsSecurePasswordConstraint()
  const messageFor = (value: unknown) => constraint.defaultMessage({ value } as ValidationArguments)

  it('accepts a password meeting every rule', () => {
    expect(constraint.validate('Str0ng!Pass')).toBe(true)
  })

  it.each([
    ['too short', 'Aa1!aa'],
    ['no lowercase', 'ABCDEFG1!'],
    ['no uppercase', 'abcdefg1!'],
    ['no digit', 'Abcdefgh!'],
    ['no special character', 'Abcdefg12'],
  ])('rejects a password with %s', (_label, password) => {
    expect(constraint.validate(password)).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(constraint.validate(12345678)).toBe(false)
    expect(constraint.validate(undefined)).toBe(false)
    expect(messageFor(42)).toBe('Password must be a string.')
  })

  it('rejects passwords bcrypt would silently truncate', () => {
    const tooLong = 'Aa1!' + 'x'.repeat(PASSWORD_MAX_BYTES)
    expect(constraint.validate(tooLong)).toBe(false)
  })

  it('lists only the missing requirements in the message', () => {
    const message = messageFor('abcdefgh')
    expect(message).toContain('uppercase')
    expect(message).toContain('digit')
    expect(message).toContain('special character')
    expect(message).not.toContain('lowercase')
  })
})
