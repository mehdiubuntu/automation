import { maskEmail, redactSensitive } from '@presentation/common/utils/redact.util'

describe('redactSensitive', () => {
  it('removes passwords, codes and tokens at any depth', () => {
    const redacted = redactSensitive({ email: 'jane@example.test', password: 'P@ssw0rd!', nested: { newPassword: 'x', code: '123456', refreshToken: 'abc', ok: 1 } })

    expect(JSON.stringify(redacted)).not.toMatch(/P@ssw0rd|123456|abc|"x"/)
    expect(redacted).toMatchObject({ nested: { ok: 1 } })
  })

  it('masks email addresses instead of logging them in full', () => {
    expect(maskEmail('jane@example.test')).toBe('j***@example.test')
    expect(redactSensitive({ email: 'jane@example.test' })).toEqual({ email: 'j***@example.test' })
  })

  it('passes primitives and null through', () => {
    expect(redactSensitive(null)).toBeNull()
    expect(redactSensitive('text')).toBe('text')
  })
})
