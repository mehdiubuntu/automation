import { jobsConfig } from '@infrastructure/config/jobs/jobs.config'

describe('jobsConfig', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it('enables every engine by default outside production', () => {
    delete process.env.ENGINES_ENABLED
    process.env.NODE_ENV = 'development'

    expect(jobsConfig().enabledEngines).toBe('*')
  })

  it('refuses to start in production without an explicit ENGINES_ENABLED', () => {
    delete process.env.ENGINES_ENABLED
    process.env.NODE_ENV = 'production'

    expect(() => jobsConfig()).toThrow('ENGINES_ENABLED must be set in production')
  })

  it('reads "*", "none" and a comma-separated list', () => {
    process.env.NODE_ENV = 'production'
    for (const [raw, expected] of [
      ['*', '*'],
      ['none', []],
      ['NONE', []],
      [' audit , keyword ', ['audit', 'keyword']],
    ] as const) {
      process.env.ENGINES_ENABLED = raw
      expect(jobsConfig().enabledEngines).toEqual(expected)
    }
  })

  it('reads the worker settings with sensible defaults and rejects nonsense', () => {
    process.env.ENGINES_ENABLED = '*'
    delete process.env.WORKER_ENGINES
    delete process.env.WORKER_POLL_INTERVAL_MS
    delete process.env.JOB_LEASE_SECONDS

    expect(jobsConfig()).toMatchObject({ workerEngines: [], pollIntervalMs: 1000, leaseSeconds: 60, retentionDays: 30, shutdownGraceSeconds: 30 })

    process.env.WORKER_ENGINES = 'audit,content'
    expect(jobsConfig().workerEngines).toEqual(['audit', 'content'])

    process.env.JOB_LEASE_SECONDS = '5'
    expect(() => jobsConfig()).toThrow('JOB_LEASE_SECONDS must be an integer >= 10')
  })
})
