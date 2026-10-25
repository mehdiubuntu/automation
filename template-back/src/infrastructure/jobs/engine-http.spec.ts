import { createEngineHttp, isPublicAddress } from '@infrastructure/jobs/engine-http'
import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import { gzipSync } from 'zlib'

describe('isPublicAddress', () => {
  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1', '2606:4700:4700::1111', '2a00:1450:4001:81b::200e'])(
    'allows the public address %s',
    (address) => {
      expect(isPublicAddress(address)).toBe(true)
    }
  )

  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '::ffff:169.254.169.254',
    '2001:db8::1',
  ])('refuses the internal address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })

  it('refuses anything that is not an IP address', () => {
    for (const value of ['localhost', 'example.com', '', '999.1.1.1', 'not an ip']) expect(isPublicAddress(value)).toBe(false)
  })
})

describe('engine http', () => {
  let server: Server
  let base: string
  const everything: (address: string) => boolean = () => true
  const routes: Record<string, (request: IncomingMessage, response: ServerResponse) => void> = {
    '/ok': (_req, res) => res.writeHead(200, { 'content-type': 'text/html' }).end('<h1>hello</h1>'),
    '/missing': (_req, res) => res.writeHead(404).end('nope'),
    '/to-ok': (_req, res) => res.writeHead(302, { location: '/ok' }).end(),
    '/loop': (_req, res) => res.writeHead(302, { location: '/loop' }).end(),
    '/to-private': (_req, res) => res.writeHead(302, { location: 'http://127.0.0.2:1/secret' }).end(),
    '/big': (_req, res) => res.writeHead(200).end('x'.repeat(5000)),
    '/slow': () => undefined,
    '/gzip': (_req, res) => res.writeHead(200, { 'content-encoding': 'gzip' }).end(gzipSync('compressed text')),
    '/see-other': (_req, res) => res.writeHead(303, { location: '/echo' }).end(),
    '/echo': (req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => res.writeHead(200).end(JSON.stringify({ method: req.method, type: req.headers['content-type'], body: Buffer.concat(chunks).toString() })))
    },
  }

  beforeAll(async () => {
    server = createServer((request, response) => (routes[request.url ?? '/'] ?? routes['/missing'])(request, response))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(() => {
    server.closeAllConnections()
    server.close()
  })

  const http = (allow = everything, signal = new AbortController().signal) => createEngineHttp(signal, allow)

  describe('with the real guard', () => {
    const guarded = () => createEngineHttp(new AbortController().signal)

    it('refuses loopback, private and metadata addresses before connecting', async () => {
      for (const url of [
        `${base}/ok`,
        'http://localhost:1/',
        'http://[::1]:1/',
        'http://10.1.2.3/',
        'http://169.254.169.254/latest/meta-data/',
        'http://2130706433/',
        'http://0x7f.1/',
      ]) {
        await expect(guarded().get(url)).rejects.toThrow(/non-public address/)
      }
    })

    it('refuses other schemes, credentials in the URL and garbage', async () => {
      await expect(guarded().get('ftp://example.com/file')).rejects.toThrow('Only http and https')
      await expect(guarded().get('file:///etc/passwd')).rejects.toThrow('Only http and https')
      await expect(guarded().get('https://user:pass@example.com/')).rejects.toThrow('credentials')
      await expect(guarded().get('not a url')).rejects.toThrow('Invalid URL')
    })
  })

  describe('requests', () => {
    it('returns status, headers, text body, final url and duration', async () => {
      const response = await http().get(`${base}/ok`)

      expect(response).toMatchObject({ status: 200, body: '<h1>hello</h1>', url: `${base}/ok` })
      expect(response.headers['content-type']).toBe('text/html')
      expect(response.ms).toBeGreaterThanOrEqual(0)
    })

    it('does not throw on an error status', async () => {
      expect(await http().get(`${base}/missing`)).toMatchObject({ status: 404, body: 'nope' })
    })

    it('follows redirects and reports the final url', async () => {
      expect(await http().get(`${base}/to-ok`)).toMatchObject({ status: 200, url: `${base}/ok` })
    })

    it('stops redirect loops and re-checks every hop against the guard', async () => {
      await expect(http().get(`${base}/loop`)).rejects.toThrow('Too many redirects')
      const onlyThisServer = (address: string) => address === '127.0.0.1'
      await expect(http(onlyThisServer).get(`${base}/to-private`)).rejects.toThrow(/non-public address \(127\.0\.0\.2\)/)
    })

    it('caps the response size', async () => {
      await expect(http().get(`${base}/big`, { maxBytes: 1000 })).rejects.toThrow('larger than 1000 bytes')
      expect((await http().get(`${base}/big`)).body).toHaveLength(5000)
    })

    it('times out a server that never answers', async () => {
      await expect(http().get(`${base}/slow`, { timeoutMs: 200 })).rejects.toThrow('timed out after 200 ms')
    })

    it('stops when the job is aborted', async () => {
      const controller = new AbortController()
      const pending = http(everything, controller.signal).get(`${base}/slow`, { timeoutMs: 5000 })
      setTimeout(() => controller.abort(new Error('job cancelled')), 100)

      await expect(pending).rejects.toThrow('job cancelled')
    })

    it('decompresses gzip bodies', async () => {
      expect((await http().get(`${base}/gzip`)).body).toBe('compressed text')
    })

    it('posts JSON, and turns a POST into a GET after a 303', async () => {
      const posted = JSON.parse((await http().postJson(`${base}/echo`, { a: [1, 2] })).body) as Record<string, string>
      expect(posted).toEqual({ method: 'POST', type: 'application/json', body: '{"a":[1,2]}' })

      const redirected = JSON.parse((await http().postJson(`${base}/see-other`, { a: 1 })).body) as Record<string, string>
      expect(redirected).toMatchObject({ method: 'GET', body: '' })
    })
  })
})
