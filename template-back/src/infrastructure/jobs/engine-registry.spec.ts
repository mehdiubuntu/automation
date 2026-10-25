import { ENGINES } from '@engines/index'
import { defineEngine, defineJob, EngineDefinition } from '@engines/sdk'
import { assertOwnSchemaOnly, EngineRegistry, resolveEnabledEngines } from '@infrastructure/jobs/engine-registry'
import { IsOptional, IsString } from 'class-validator'

class In {
  @IsOptional()
  @IsString()
  value?: string
}
const handler = () => Promise.resolve(null)
const engine = (id: string, extra: Partial<EngineDefinition> = {}): EngineDefinition =>
  defineEngine({ id, jobs: { [`${id}.run`]: defineJob({ input: In, handler, retries: 2, timeoutMs: 5000 }) }, ...extra })

describe('engine registry', () => {
  it('accepts every engine that ships in src/engines', () => {
    const registry = new EngineRegistry(ENGINES)

    expect(registry.enabledIds()).toEqual(ENGINES.map((e) => e.id))
    expect(registry.job('audit.run')).toMatchObject({ engine: 'audit', maxAttempts: 2, timeoutMs: 120_000 })
  })

  describe('resolveEnabledEngines', () => {
    const known = [engine('aaa'), engine('bbb'), engine('ccc')]

    it('returns all for "*", the listed ones (once each) otherwise, none for an empty list', () => {
      expect(resolveEnabledEngines('*', known)).toBe(known)
      expect(resolveEnabledEngines(['ccc', 'aaa', 'ccc'], known).map((e) => e.id)).toEqual(['ccc', 'aaa'])
      expect(resolveEnabledEngines([], known)).toEqual([])
    })

    it('names the known ids when one is not registered', () => {
      expect(() => resolveEnabledEngines(['zzz'], known)).toThrow('lists "zzz" but src/engines/index.ts has no such engine (known: aaa, bbb, ccc)')
    })
  })

  describe('validation at boot', () => {
    it.each([
      ['an id with capitals', engine('Audit'), 'the id must be'],
      ['an id that is too short', engine('a'), 'the id must be'],
      ['a reserved schema name', engine('platform'), 'the id must be'],
      ['a pg_ prefixed id', engine('pg_thing'), 'the id must be'],
      ['no jobs', defineEngine({ id: 'empty', jobs: {} }), 'declares no jobs'],
      ['a job type without the engine prefix', defineEngine({ id: 'aaa', jobs: { 'bbb.run': defineJob({ input: In, handler }) } }), 'must look like "aaa.<name>"'],
      ['a bad concurrency', engine('aaa', { concurrency: 0 }), 'concurrency must be'],
      ['a timeout below one second', defineEngine({ id: 'aaa', jobs: { 'aaa.run': defineJob({ input: In, handler, timeoutMs: 10 }) } }), 'timeoutMs must be'],
      ['too many retries', defineEngine({ id: 'aaa', jobs: { 'aaa.run': defineJob({ input: In, handler, retries: 11 }) } }), 'retries must be'],
    ])('rejects %s', (_label, bad, message) => {
      expect(() => new EngineRegistry([bad])).toThrow(message)
    })

    it('rejects the same engine twice and the same job type from two engines', () => {
      expect(() => new EngineRegistry([engine('aaa'), engine('aaa')])).toThrow('registered twice')
      const clash = defineEngine({ id: 'bbb', jobs: { 'aaa.run': defineJob({ input: In, handler }) } })
      expect(() => new EngineRegistry([engine('aaa'), clash])).toThrow()
    })
  })

  describe('lookups', () => {
    const registry = new EngineRegistry([engine('aaa', { concurrency: 5 }), engine('bbb')])

    it('describes job types and validates their input', async () => {
      expect(registry.describe('aaa.run')).toEqual({ engine: 'aaa', maxAttempts: 3 })
      expect(registry.describe('aaa.missing')).toBeUndefined()
      expect(await registry.validateInput('aaa.run', { value: 'x' })).toMatchObject({ ok: true })
      expect(await registry.validateInput('aaa.run', { value: 5 })).toMatchObject({ ok: false })
      expect(await registry.validateInput('nope.run', {})).toEqual({ ok: false, errors: ['unknown job type "nope.run"'] })
    })

    it('reports concurrency (default 2) and the engines a worker runs', () => {
      expect(registry.concurrencyOf('aaa')).toBe(5)
      expect(registry.concurrencyOf('bbb')).toBe(2)
      expect(registry.workerEngineIds([])).toEqual(['aaa', 'bbb'])
      expect(registry.workerEngineIds(['bbb'])).toEqual(['bbb'])
      expect(() => registry.workerEngineIds(['ccc'])).toThrow('WORKER_ENGINES lists ccc, which is not enabled')
    })
  })
})

describe('assertOwnSchemaOnly', () => {
  const others = ['audit', 'keyword']

  it('accepts unqualified SQL, its own schema and look-alikes', () => {
    expect(() => assertOwnSchemaOnly('SELECT * FROM findings WHERE id = $1', 'audit', others)).not.toThrow()
    expect(() => assertOwnSchemaOnly('SELECT * FROM audit.findings f JOIN audit."runs" r ON r.id = f.run_id', 'audit', others)).not.toThrow()
    expect(() => assertOwnSchemaOnly('SELECT excluded.score, platformer.x FROM t', 'audit', others)).not.toThrow()
    expect(() => assertOwnSchemaOnly("INSERT INTO t (note) VALUES ('about the jobs queue')", 'audit', others)).not.toThrow()
  })

  it.each([
    ['core tables', 'SELECT * FROM platform."User"', 'references "platform"'],
    ['quoted schemas', 'SELECT * FROM "platform"."User"', 'references "platform"'],
    ['the jobs schema', 'DELETE FROM jobs.job_run', 'references "jobs"'],
    ['public', 'SELECT * FROM public.things', 'references "public"'],
    ['another engine', 'SELECT * FROM keyword.keyword', 'references "keyword"'],
    ['case tricks', 'SELECT * FROM PLATFORM.x', 'references "PLATFORM"'],
    ['search_path', 'SET search_path TO platform', 'is not allowed'],
    ['role switching', 'SET ROLE postgres', 'is not allowed'],
    ['schema DDL', 'CREATE SCHEMA other', 'is not allowed'],
    ['extensions', 'CREATE EXTENSION pg_trgm', 'is not allowed'],
  ])('refuses %s', (_label, sql, message) => {
    expect(() => assertOwnSchemaOnly(sql, 'audit', others)).toThrow(message)
  })

  it('ignores what only appears in comments', () => {
    expect(() => assertOwnSchemaOnly('-- see platform.User\nSELECT 1 /* jobs.job_run */', 'audit', others)).not.toThrow()
  })
})
