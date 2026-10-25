import { intEnv, isProduction } from '@infrastructure/config/env.util'
import { registerAs } from '@nestjs/config'

const ids = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

/** '*' = every engine in src/engines/index.ts. In production the list must be explicit, so unreviewed engine code never runs by accident. */
function enabledEngines(): '*' | string[] {
  const raw = process.env.ENGINES_ENABLED?.trim()
  if (!raw) {
    if (isProduction()) throw new Error('ENGINES_ENABLED must be set in production: comma-separated engine ids, "*" for all of them, or "none"')
    return '*'
  }
  if (raw === '*') return '*'
  return raw.toLowerCase() === 'none' ? [] : ids(raw)
}

export const jobsConfig = registerAs('JobsConfig', () => ({
  enabledEngines: enabledEngines(),
  /** Worker only: run just these engines in this process (empty = every enabled engine). */
  workerEngines: ids(process.env.WORKER_ENGINES),
  pollIntervalMs: intEnv('WORKER_POLL_INTERVAL_MS', 1000, 100),
  /** How long a running job stays reserved for its worker without a heartbeat before another worker may take it over. */
  leaseSeconds: intEnv('JOB_LEASE_SECONDS', 60, 10),
  retentionDays: intEnv('JOB_RETENTION_DAYS', 30, 1),
  /** On SIGTERM the worker waits this long for running jobs to finish before handing them back to the queue. */
  shutdownGraceSeconds: intEnv('WORKER_SHUTDOWN_GRACE_SECONDS', 30, 1),
}))

export type JobsConfigType = ReturnType<typeof jobsConfig>
