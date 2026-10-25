import { isPasswordPolicySatisfied, PASSWORD_MAX_BYTES, passwordPolicyViolations } from '@domain/auth/policy/password.policy'

describe('password policy', () => {
  it('accepts a password meeting every rule', () => {
    expect(isPasswordPolicySatisfied('Str0ng!Pass')).toBe(true)
  })

  it.each([
    ['too short', 'Aa1!aa'],
    ['without a lowercase letter', 'ABCDEFG1!'],
    ['without an uppercase letter', 'abcdefg1!'],
    ['without a digit', 'Abcdefgh!'],
    ['without a special character', 'Abcdefg12'],
    ['longer than bcrypt can hash (73+ bytes)', 'Aa1!' + 'x'.repeat(PASSWORD_MAX_BYTES)],
  ])('rejects a password that is %s', (_label, password) => {
    expect(isPasswordPolicySatisfied(password)).toBe(false)
  })

  it('counts bytes, not characters, for the 72 limit', () => {
    const multibyte = 'Aa1!' + 'é'.repeat(35) // 4 + 70 bytes = 74
    expect(multibyte.length).toBeLessThan(PASSWORD_MAX_BYTES)
    expect(isPasswordPolicySatisfied(multibyte)).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isPasswordPolicySatisfied(12345678)).toBe(false)
    expect(isPasswordPolicySatisfied(undefined)).toBe(false)
  })

  it('lists only the missing requirements', () => {
    const missing = passwordPolicyViolations('abcdefgh').join(' | ')
    expect(missing).toContain('uppercase')
    expect(missing).toContain('digit')
    expect(missing).toContain('special character')
    expect(missing).not.toContain('lowercase')
  })
})
