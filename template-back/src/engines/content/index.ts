/**
 * Content engine: turns a target keyword (and an optional brief) into an article draft, stored as an immutable version.
 * Starter only - no AI provider is connected yet, so the job stores an empty version 1.
 * The content developer fills in write() once a provider is chosen (the core team then adds it to ctx).
 */
import { createHash } from 'crypto'
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { defineEngine, defineJob, EngineContext } from '../sdk'

class GenerateArticleInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  keyword: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  brief?: string
}

interface GenerateArticleResult {
  keyword: string
  version: number
  title: string
  contentHash: string
  note: string
}

async function write(ctx: EngineContext, input: GenerateArticleInput): Promise<GenerateArticleResult> {
  ctx.log.info('article generation started', { keyword: input.keyword })
  ctx.progress(10, 'started')

  // Replace this stub: ask the chosen AI provider for the article, then store the exact text it produced.
  const title = input.keyword
  const body = ''
  const contentHash = createHash('sha256').update(body).digest('hex')

  // Versions are immutable: approval is later tied to one exact version (and its hash), so a retry never rewrites a row.
  await ctx.db.query(
    `INSERT INTO article_version (project_id, job_id, keyword, version, title, body, content_hash) VALUES ($1, $2, $3, 1, $4, $5, $6)
     ON CONFLICT (job_id) DO NOTHING`,
    [ctx.projectId, ctx.jobId, input.keyword, title, body, contentHash]
  )
  ctx.progress(100)
  return { keyword: input.keyword, version: 1, title, contentHash, note: 'No AI provider is connected yet.' }
}

export default defineEngine({
  id: 'content',
  concurrency: 2,
  jobs: {
    'content.generate': defineJob({ input: GenerateArticleInput, handler: write, timeoutMs: 600_000, retries: 1 }),
  },
})
