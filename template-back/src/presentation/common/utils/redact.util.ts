const SENSITIVE_KEY = /pass(word)?|token|secret|code|authorization|cookie|otp/i
const REDACTED = '[REDACTED]'

export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  return at > 0 ? `${email[0]}***${email.slice(at)}` : REDACTED
}

/** Copy of a request payload that is safe to log: secrets are removed, email addresses masked. */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((entry) => redactSensitive(entry, depth + 1))

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (SENSITIVE_KEY.test(key)) return [key, REDACTED]
      if (/e-?mail/i.test(key) && typeof entry === 'string') return [key, maskEmail(entry)]
      return [key, redactSensitive(entry, depth + 1)]
    })
  )
}
