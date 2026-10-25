import { HttpResponse, testEngine } from '../sdk'
import engine, { checkPage } from './index'

const GOOD_PAGE = `<!doctype html><html lang="en"><head><title>Immigration help</title>
<meta name="description" content="Plain-language immigration support."><link rel="canonical" href="https://example.com/"></head>
<body><h1>Welcome</h1><img src="a.png" alt="Team"></body></html>`

const respond = (status: number, body: string): { get: () => Promise<HttpResponse> } => ({
  get: () => Promise.resolve({ status, headers: {}, body, url: 'https://example.com/', ms: 42 }),
})

describe('audit engine', () => {
  describe('checkPage', () => {
    it('finds nothing wrong with a healthy page', () => {
      expect(checkPage(200, GOOD_PAGE)).toEqual([])
    })

    it('reports the problems of a bare page', () => {
      const checks = checkPage(200, '<html><body><img src="a.png"></body></html>').map((finding) => finding.check)

      expect(checks).toEqual(expect.arrayContaining(['title', 'meta-description', 'h1', 'html-lang', 'canonical', 'image-alt']))
    })

    it('flags error statuses and noindex', () => {
      const checks = checkPage(404, `${GOOD_PAGE}<meta name="robots" content="noindex,follow">`).map((finding) => finding.check)

      expect(checks).toEqual(expect.arrayContaining(['http-status', 'robots']))
    })
  })

  describe('audit.run', () => {
    it('fetches the page, scores it and stores one row for the job', async () => {
      const stored: unknown[][] = []
      const run = await testEngine(
        engine,
        'audit.run',
        { url: 'https://example.com/' },
        { http: respond(200, GOOD_PAGE), db: { query: (_sql, params) => (stored.push(params ?? []), Promise.resolve([])) } }
      )

      expect(run.result).toMatchObject({ status: 200, score: 100, findings: [], loadMs: 42 })
      expect(stored).toHaveLength(1)
      expect(run.progress.at(-1)).toEqual({ percent: 100, note: undefined })
    })

    it('lowers the score for every finding', async () => {
      const run = await testEngine(
        engine,
        'audit.run',
        { url: 'https://example.com/' },
        { http: respond(200, '<html></html>'), db: { query: () => Promise.resolve([]) } }
      )

      expect((run.result as { score: number }).score).toBeLessThan(100)
    })

    it('refuses an input that is not an http(s) URL', async () => {
      await expect(testEngine(engine, 'audit.run', { url: 'ftp://example.com' })).rejects.toThrow('Invalid input')
      await expect(testEngine(engine, 'audit.run', {})).rejects.toThrow('Invalid input')
    })
  })
})
