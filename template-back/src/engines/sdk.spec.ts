import { IsInt, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { defineEngine, defineJob, EngineContext, EngineError, testEngine, validateJobInput } from './sdk'

class Nested {
  @IsInt()
  depth: number
}

class Input {
  @IsString()
  name: string

  @IsOptional()
  @ValidateNested()
  @Type(() => Nested)
  nested?: Nested
}

const engine = defineEngine({
  id: 'demo',
  jobs: {
    'demo.run': defineJob({
      input: Input,
      handler: async (ctx: EngineContext, input: Input) => {
        ctx.log.info('hello', { name: input.name })
        ctx.log.warn('careful')
        ctx.progress(30, 'working')
        await ctx.db.query('SELECT 1')
        return { name: input.name, project: ctx.projectId, attempt: ctx.attempt }
      },
    }),
    'demo.net': defineJob({ input: Input, handler: (ctx: EngineContext) => ctx.http.get('https://example.test') }),
  },
})

describe('engine SDK', () => {
  describe('validateJobInput', () => {
    it('returns a cleaned instance of the input class', async () => {
      const checked = await validateJobInput(Input, { name: 'a', nested: { depth: 2 } })

      expect(checked.ok).toBe(true)
      expect(checked.ok && checked.value).toBeInstanceOf(Input)
    })

    it('rejects unknown properties, wrong types, nested errors and non-objects', async () => {
      expect(await validateJobInput(Input, { name: 'a', extra: 1 })).toMatchObject({ ok: false })
      expect(await validateJobInput(Input, { name: 5 })).toMatchObject({ ok: false })
      expect(await validateJobInput(Input, { name: 'a', nested: { depth: 'x' } })).toEqual({ ok: false, errors: [expect.stringContaining('nested.depth')] })
      for (const raw of [null, 'text', 7, ['a']]) expect(await validateJobInput(Input, raw)).toEqual({ ok: false, errors: ['input must be an object'] })
    })
  })

  describe('testEngine', () => {
    it('runs the handler with a fake context and records logs and progress', async () => {
      const run = await testEngine(engine, 'demo.run', { name: 'ada' }, { projectId: 'p-1', attempt: 3, db: { query: () => Promise.resolve([]) } })

      expect(run.result).toEqual({ name: 'ada', project: 'p-1', attempt: 3 })
      expect(run.logs).toEqual([
        { level: 'info', message: 'hello', data: { name: 'ada' } },
        { level: 'warn', message: 'careful', data: undefined },
      ])
      expect(run.progress).toEqual([{ percent: 30, note: 'working' }])
    })

    it('keeps the network and the database out of tests unless a fake is passed', async () => {
      await expect(testEngine(engine, 'demo.run', { name: 'ada' })).rejects.toThrow('ctx.db.query is not available in tests')
      await expect(testEngine(engine, 'demo.net', { name: 'ada' })).rejects.toThrow('ctx.http.get is not available in tests')
    })

    it('fails on an unknown job type or an invalid input, like production', async () => {
      await expect(testEngine(engine, 'demo.nope', {})).rejects.toThrow('no job type "demo.nope"')
      await expect(testEngine(engine, 'demo.run', {})).rejects.toThrow('Invalid input')
    })
  })

  it('EngineError is retryable unless told otherwise', () => {
    expect(new EngineError('x').retryable).toBe(true)
    expect(new EngineError('x', false).retryable).toBe(false)
    expect(new EngineError('x')).toBeInstanceOf(Error)
  })
})
