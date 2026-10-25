import { fakeId } from '@application/shared/testing/fake-id'
import { OtpPurpose } from '@domain/otp/enum/otp.enum'
import { CryptoOtpCodeProvider } from '@infrastructure/auth/crypto-otp-code.provider'
import { ConfigService } from '@nestjs/config'

const config = { get: () => 'unit-test-otp-secret-unit-test-otp-secret' } as unknown as ConfigService

describe('CryptoOtpCodeProvider', () => {
  const provider = new CryptoOtpCodeProvider(config)
  const context = { userId: fakeId(7), purpose: OtpPurpose.EMAIL_VERIFICATION }

  it('generates 6-digit numeric codes, zero padded', () => {
    for (let i = 0; i < 200; i++) expect(provider.generate()).toMatch(/^\d{6}$/)
  })

  it('stores only a keyed hash that never contains the code', () => {
    const hash = provider.hash('123456', context)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain('123456')
  })

  it('accepts the right code and rejects a wrong one', () => {
    const hash = provider.hash('123456', context)
    expect(provider.matches('123456', context, hash)).toBe(true)
    expect(provider.matches('123457', context, hash)).toBe(false)
  })

  it('binds the hash to the user and the purpose', () => {
    const hash = provider.hash('123456', context)
    expect(provider.matches('123456', { ...context, userId: fakeId(8) }, hash)).toBe(false)
    expect(provider.matches('123456', { ...context, purpose: OtpPurpose.PASSWORD_RESET }, hash)).toBe(false)
  })

  it('does not throw on a malformed stored hash', () => {
    expect(provider.matches('123456', context, 'short')).toBe(false)
  })
})
