export const PASSWORD_MIN_LENGTH = 8
// bcrypt only hashes the first 72 bytes - longer input would be silently truncated
export const PASSWORD_MAX_BYTES = 72

export const PASSWORD_RULES: ReadonlyArray<{ check: (value: string) => boolean; requirement: string }> = [
  { check: (value) => value.length >= PASSWORD_MIN_LENGTH, requirement: `at least ${PASSWORD_MIN_LENGTH} characters` },
  { check: (value) => Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES, requirement: `at most ${PASSWORD_MAX_BYTES} characters` },
  { check: (value) => /[a-z]/.test(value), requirement: 'at least one lowercase letter' },
  { check: (value) => /[A-Z]/.test(value), requirement: 'at least one uppercase letter' },
  { check: (value) => /[0-9]/.test(value), requirement: 'at least one digit' },
  { check: (value) => /[^A-Za-z0-9]/.test(value), requirement: 'at least one special character (such as !@#$%)' },
]

/** The unmet requirements, empty when the password satisfies the policy. */
export function passwordPolicyViolations(value: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.check(value)).map((rule) => rule.requirement)
}

export function isPasswordPolicySatisfied(value: unknown): value is string {
  return typeof value === 'string' && passwordPolicyViolations(value).length === 0
}
