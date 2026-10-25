export const EMAIL_MAX_LENGTH = 254

/** The one canonical form every lookup and insert uses: trimmed and lower-cased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
