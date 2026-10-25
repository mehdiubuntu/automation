/** Fail-fast readers for environment variables: a missing or nonsensical value aborts boot rather than falling back silently. */
export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function requiredSecret(name: string, minLength = 32): string {
  const value = requiredEnv(name)
  if (value.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters`)
  }
  return value
}

export function intEnv(name: string, fallback: number, min = 0): number {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min} (got "${raw}")`)
  }
  return value
}

export function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase()
  if (raw === undefined || raw === '') return fallback
  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`${name} must be "true" or "false" (got "${raw}")`)
  }
  return raw === 'true'
}

export const isProduction = (): boolean => process.env.NODE_ENV === 'production'
