import { isProduction } from '@infrastructure/config/env.util'
import { registerAs } from '@nestjs/config'

function requiredWhenEnabled(name: string): string {
  const value = process.env[name]
  // Fail fast: a half-configured mailer that drops emails silently is worse than not booting.
  if (!value) {
    throw new Error(`EMAIL_ENABLED=true but required email environment variable is missing: ${name}`)
  }
  return value
}

export const emailConfig = registerAs('EmailConfig', () => {
  const enabled = process.env.EMAIL_ENABLED === 'true'
  if (!enabled) {
    // The log-only adapter is a development convenience — production must always run real SMTP.
    if (isProduction()) {
      throw new Error('EMAIL_ENABLED must be true in production — the log-only email adapter is not allowed outside development')
    }
    return { enabled: false as const }
  }

  return {
    enabled: true as const,
    host: requiredWhenEnabled('EMAIL_HOST'),
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    /** STARTTLS enforcement for port-587 setups (secure=false); refuse to send plaintext. */
    requireTls: process.env.EMAIL_REQUIRE_TLS === 'true',
    // Auth is optional: local relays (e.g. MailHog) accept unauthenticated mail.
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: requiredWhenEnabled('EMAIL_FROM'),
    replyTo: process.env.EMAIL_REPLY_TO,
  }
})

export type EmailConfigType = ReturnType<typeof emailConfig>
