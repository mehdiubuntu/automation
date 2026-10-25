import { testEngine } from '../sdk'
import engine from './index'

describe('keyword engine', () => {
  it('records the run for the project and normalises the market', async () => {
    const stored: unknown[][] = []
    const run = await testEngine(
      engine,
      'keyword.research',
      { seed: 'immigration lawyer', country: 'us', language: 'EN' },
      { projectId: '00000000-0000-7000-8000-0000000000aa', db: { query: (_sql, params) => (stored.push(params ?? []), Promise.resolve([])) } }
    )

    expect(run.result).toMatchObject({ seed: 'immigration lawyer', country: 'US', language: 'en', keywords: [] })
    expect(stored[0]).toEqual(['00000000-0000-7000-8000-0000000000aa', '00000000-0000-7000-8000-00000000000a', 'immigration lawyer', 'US', 'en', 0])
  })

  it('rejects a seed that is empty or a market that is not a 2-letter code', async () => {
    await expect(testEngine(engine, 'keyword.research', { seed: '', country: 'US', language: 'en' })).rejects.toThrow('Invalid input')
    await expect(testEngine(engine, 'keyword.research', { seed: 'visa', country: 'USA', language: 'en' })).rejects.toThrow('Invalid input')
  })
})
