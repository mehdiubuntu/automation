/** Router state passed to /verify-email by the pages that send the user there. */
export interface VerifyEmailLocationState {
  email?: string
  /** True when a code was JUST emailed (after registering) — starts the resend cooldown. */
  codeSent?: boolean
}

/** Router state passed to /reset-password after requesting a reset code. */
export interface ResetPasswordLocationState {
  email?: string
}

/** Router state set by RequireAuth: where the user was headed before the login redirect. */
export interface LoginLocationState {
  from?: string
}

/** Only follow in-app, absolute paths, never an attacker-supplied URL. */
export function safeRedirect(from: string | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/login')) return '/'
  return from
}
