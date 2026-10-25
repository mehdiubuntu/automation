import { isOriginAllowed } from '@presentation/common/utils/origin-check.util'

const allowedOrigins = ['https://app.example.test']
const base = { method: 'POST', hasCookies: true, allowedOrigins }

describe('isOriginAllowed', () => {
  it('lets safe methods through without looking at the origin', () => {
    expect(isOriginAllowed({ ...base, method: 'GET', origin: 'https://evil.test' })).toBe(true)
  })

  it('accepts a state-changing request from an allowed Origin', () => {
    expect(isOriginAllowed({ ...base, origin: 'https://app.example.test' })).toBe(true)
  })

  it('rejects a mismatching or opaque Origin', () => {
    expect(isOriginAllowed({ ...base, origin: 'https://evil.test' })).toBe(false)
    expect(isOriginAllowed({ ...base, origin: 'null' })).toBe(false)
  })

  it('falls back to the Referer origin when there is no Origin', () => {
    expect(isOriginAllowed({ ...base, referer: 'https://app.example.test/settings' })).toBe(true)
    expect(isOriginAllowed({ ...base, referer: 'https://evil.test/https://app.example.test' })).toBe(false)
    expect(isOriginAllowed({ ...base, referer: 'not a url' })).toBe(false)
  })

  it('lets Origin win over a friendly Referer', () => {
    expect(isOriginAllowed({ ...base, origin: 'https://evil.test', referer: 'https://app.example.test/' })).toBe(false)
  })

  it('refuses a cookie-bearing request with neither header, but not a cookie-less one', () => {
    expect(isOriginAllowed({ ...base })).toBe(false)
    expect(isOriginAllowed({ ...base, hasCookies: false })).toBe(true)
  })
})
