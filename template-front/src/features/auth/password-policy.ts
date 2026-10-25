/**
 * Client-side mirror of the backend password policy: min 8 chars, >=1
 * lowercase, >=1 uppercase, >=1 digit, >=1 special char, and at most 72 BYTES
 * (bcrypt's input limit; multi-byte characters count for more than one).
 * The server still enforces it; this is just fast, friendly feedback.
 */
export interface PasswordRule {
  label: string
  test: (v: string) => boolean
}

const MAX_PASSWORD_BYTES = 72
const encoder = new TextEncoder()

export const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'A number', test: (v) => /\d/.test(v) },
  { label: 'A special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
  {
    label: `At most ${MAX_PASSWORD_BYTES} bytes`,
    test: (v) => encoder.encode(v).length <= MAX_PASSWORD_BYTES,
  },
]

export function isPasswordValid(v: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(v))
}
