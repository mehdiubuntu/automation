/**
 * Audit engine: checks a web page for technical / on-page SEO problems and stores the findings.
 * This is the first working slice (HTML checks only) - the audit developer extends it (PageSpeed, crawling, more checks).
 */
import { IsUrl } from 'class-validator'
import { defineEngine, defineJob, EngineContext } from '../sdk'

class AuditRunInput {
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url: string
}

type Severity = 'error' | 'warning' | 'info'

export interface AuditFinding {
  check: string
  severity: Severity
  message: string
}

interface AuditResult {
  url: string
  finalUrl: string
  status: number
  loadMs: number
  score: number
  findings: AuditFinding[]
}

const PENALTY: Record<Severity, number> = { error: 15, warning: 5, info: 0 }
const TITLE_MAX = 60

/** Pure and synchronous: HTML in, findings out. Add new checks here and cover them in index.spec.ts. */
export function checkPage(status: number, html: string): AuditFinding[] {
  const findings: AuditFinding[] = []
  const add = (check: string, severity: Severity, message: string) => findings.push({ check, severity, message })

  if (status >= 400) add('http-status', 'error', `The page answered with HTTP ${status}.`)

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim()
  if (!title) add('title', 'error', 'The page has no <title>.')
  else if (title.length > TITLE_MAX) add('title-length', 'warning', `The title is ${title.length} characters; about ${TITLE_MAX} fit in search results.`)

  if (!/<meta[^>]+name=["']description["'][^>]*content=["'][^"']+["']/i.test(html)) add('meta-description', 'warning', 'The page has no meta description.')

  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length
  if (h1Count === 0) add('h1', 'error', 'The page has no <h1>.')
  else if (h1Count > 1) add('h1', 'warning', `The page has ${h1Count} <h1> headings; one is expected.`)

  if (!/<html[^>]+lang=/i.test(html)) add('html-lang', 'warning', 'The <html> element has no lang attribute.')
  if (!/<link[^>]+rel=["']canonical["']/i.test(html)) add('canonical', 'info', 'The page declares no canonical URL.')
  if (/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) add('robots', 'error', 'The page asks search engines not to index it (noindex).')

  const images = html.match(/<img\b[^>]*>/gi) ?? []
  const withoutAlt = images.filter((tag) => !/\balt=/i.test(tag)).length
  if (withoutAlt > 0) add('image-alt', 'warning', `${withoutAlt} of ${images.length} images have no alt attribute.`)

  return findings
}

async function runAudit(ctx: EngineContext, input: AuditRunInput): Promise<AuditResult> {
  ctx.log.info('audit started', { url: input.url })
  const page = await ctx.http.get(input.url)
  ctx.progress(50, 'page fetched')

  const findings = checkPage(page.status, page.body)
  const score = Math.max(0, 100 - findings.reduce((sum, finding) => sum + PENALTY[finding.severity], 0))

  // A retried attempt overwrites its earlier row (same job_id) instead of adding a second one.
  await ctx.db.query(
    `INSERT INTO audit_run (project_id, job_id, url, status_code, score, findings) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (job_id) DO UPDATE SET status_code = EXCLUDED.status_code, score = EXCLUDED.score, findings = EXCLUDED.findings`,
    [ctx.projectId, ctx.jobId, input.url, page.status, score, JSON.stringify(findings)]
  )
  ctx.progress(100)
  return { url: input.url, finalUrl: page.url, status: page.status, loadMs: page.ms, score, findings }
}

export default defineEngine({
  id: 'audit',
  concurrency: 3,
  jobs: {
    'audit.run': defineJob({ input: AuditRunInput, handler: runAudit, timeoutMs: 120_000, retries: 1 }),
  },
})
