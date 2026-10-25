import { createHash } from 'crypto'
import { testEngine } from '../sdk'
import engine from './index'

describe('content engine', () => {
  it('stores an immutable version 1 and returns its hash', async () => {
    const stored: unknown[][] = []
    const run = await testEngine(
      engine,
      'content.generate',
      { keyword: 'green card timeline' },
      { db: { query: (_sql, params) => (stored.push(params ?? []), Promise.resolve([])) } }
    )

    expect(run.result).toMatchObject({ keyword: 'green card timeline', version: 1, contentHash: createHash('sha256').update('').digest('hex') })
    expect(stored).toHaveLength(1)
  })

  it('rejects an empty keyword and an oversized brief', async () => {
    await expect(testEngine(engine, 'content.generate', { keyword: '' })).rejects.toThrow('Invalid input')
    await expect(testEngine(engine, 'content.generate', { keyword: 'visa', brief: 'x'.repeat(4001) })).rejects.toThrow('Invalid input')
  })
})
