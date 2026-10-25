import { testEngine } from '../sdk'
import engine from './index'

describe('example engine', () => {
  it('echoes the text, reports progress and writes one row for the job', async () => {
    const calls: unknown[][] = []
    const run = await testEngine(engine, 'example.echo', { text: 'hello' }, { db: { query: (_sql, params) => (calls.push(params ?? []), Promise.resolve([])) } })

    expect(run.result).toEqual({ echoed: 'hello', attempt: 1 })
    expect(run.progress).toEqual([{ percent: 50, note: 'halfway' }])
    expect(calls).toHaveLength(1)
  })

  it('rejects invalid input exactly like production does', async () => {
    await expect(testEngine(engine, 'example.echo', { text: 5 })).rejects.toThrow('Invalid input')
    await expect(testEngine(engine, 'example.echo', { text: 'x', extra: true })).rejects.toThrow('Invalid input')
  })
})
