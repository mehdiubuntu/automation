import { EngineHttp, HttpRequestOptions, HttpResponse } from '@engines/sdk'
import { lookup as dnsLookup } from 'dns'
import { request as httpRequest, IncomingMessage } from 'http'
import { request as httpsRequest } from 'https'
import { BlockList, isIP, LookupFunction } from 'net'
import { createBrotliDecompress, createGunzip, createInflate } from 'zlib'

const MAX_REDIRECTS = 5
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024
const USER_AGENT = 'app-engine/1.0'
const REDIRECTS = [301, 302, 303, 307, 308]

const nonPublic = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  nonPublic.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['100::', 64],
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  nonPublic.addSubnet(network, prefix, 'ipv6')
}

/** True only for public unicast addresses. IPv4-mapped IPv6 (::ffff:10.0.0.1) is judged by the IPv4 address inside. */
export function isPublicAddress(address: string): boolean {
  const unscoped = address.split('%')[0]
  const family = isIP(unscoped)
  return family !== 0 && !nonPublic.check(unscoped, family === 4 ? 'ipv4' : 'ipv6')
}

type Allow = (address: string) => boolean

interface Answer {
  status: number
  headers: Record<string, string>
  body: string
}

/** Resolves the name, then refuses the connection unless at least one answer is allowed - checked at connect time, so DNS tricks cannot swap it afterwards. */
const guardedLookup =
  (allow: Allow): LookupFunction =>
  (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) return callback(error, '', 0)
      const allowed = addresses.filter((entry) => allow(entry.address))
      if (allowed.length === 0) return callback(Object.assign(new Error(`Refusing to call a non-public address (${hostname})`), { code: 'EBLOCKED' }), '', 0)
      return options.all ? callback(null, allowed) : callback(null, allowed[0].address, allowed[0].family)
    })
  }

const decoded = (response: IncomingMessage) => {
  switch (String(response.headers['content-encoding'] ?? '').toLowerCase()) {
    case 'gzip':
      return response.pipe(createGunzip())
    case 'deflate':
      return response.pipe(createInflate())
    case 'br':
      return response.pipe(createBrotliDecompress())
    default:
      return response
  }
}

/** A request is always bounded: by its own timeout, by the size cap, and by the job's abort signal (cancel / job timeout). */
function once(method: string, rawUrl: string, body: string | undefined, options: HttpRequestOptions, jobSignal: AbortSignal, allow: Allow): Promise<Answer> {
  return new Promise<Answer>((resolve, reject) => {
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      return reject(new Error(`Invalid URL: ${rawUrl}`))
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return reject(new Error('Only http and https URLs are allowed'))
    if (url.username || url.password) return reject(new Error('URLs with credentials are not allowed'))
    const literal = url.hostname.replace(/^\[|\]$/g, '')
    if (isIP(literal) && !allow(literal)) return reject(new Error(`Refusing to call a non-public address (${literal})`))

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs} ms`)), timeoutMs)
    const onJobAbort = () => controller.abort(jobSignal.reason)
    if (jobSignal.aborted) onJobAbort()
    else jobSignal.addEventListener('abort', onJobAbort, { once: true })

    // Exactly one outcome wins; every later event (socket resets after our own destroy, ...) is ignored.
    let settled = false
    const settle = (finish: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      jobSignal.removeEventListener('abort', onJobAbort)
      finish()
    }
    // The reason WE ended the request (timeout, job abort) beats the generic socket error Node reports for it.
    const explain = (error: Error): Error => (controller.signal.aborted && controller.signal.reason instanceof Error ? controller.signal.reason : error)
    const fail = (error: Error) =>
      settle(() => {
        reject(error)
        request.destroy()
      })

    const send = url.protocol === 'https:' ? httpsRequest : httpRequest
    const headers = { 'user-agent': USER_AGENT, accept: '*/*', 'accept-encoding': 'gzip, deflate, br', ...options.headers }
    const request = send(
      url,
      {
        method,
        headers: body === undefined ? headers : { ...headers, 'content-length': String(Buffer.byteLength(body)) },
        lookup: guardedLookup(allow),
        signal: controller.signal,
      },
      (response) => {
        const chunks: Buffer[] = []
        let size = 0
        const stream = decoded(response)
        response.on('error', (error) => fail(explain(error)))
        stream.on('error', (error) => fail(explain(error)))
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) fail(new Error(`Response is larger than ${maxBytes} bytes`))
          else chunks.push(chunk)
        })
        stream.on('end', () =>
          settle(() => {
            const flat = Object.entries(response.headers).map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : String(value ?? '')])
            resolve({ status: response.statusCode ?? 0, headers: Object.fromEntries(flat) as Record<string, string>, body: Buffer.concat(chunks).toString('utf8') })
          })
        )
      }
    )
    request.on('error', (error) => fail(explain(error)))
    if (body !== undefined) request.write(body)
    request.end()
  })
}

/** The outbound HTTP an engine gets as ctx.http. `allow` exists for tests only; engines cannot reach it. */
export function createEngineHttp(jobSignal: AbortSignal, allow: Allow = isPublicAddress): EngineHttp {
  async function send(method: string, startUrl: string, startBody: string | undefined, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const started = Date.now()
    let url = startUrl
    let verb = method
    let body = startBody
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const answer = await once(verb, url, body, options, jobSignal, allow)
      const location = answer.headers.location
      if (!REDIRECTS.includes(answer.status) || !location) return { ...answer, url, ms: Date.now() - started }
      url = new URL(location, url).toString()
      if (answer.status === 303 || ((answer.status === 301 || answer.status === 302) && verb === 'POST')) {
        verb = 'GET'
        body = undefined
      }
    }
    throw new Error(`Too many redirects (more than ${MAX_REDIRECTS})`)
  }

  return {
    get: (url, options) => send('GET', url, undefined, options),
    postJson: (url, body, options) => send('POST', url, JSON.stringify(body), { ...options, headers: { 'content-type': 'application/json', ...options?.headers } }),
  }
}
