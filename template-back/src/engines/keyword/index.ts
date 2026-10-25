/**
 * Keyword engine: discovers keyword ideas for a business and stores them with their source, market and timestamp.
 * Starter only - no keyword data provider is connected yet, so the job records the run and finds nothing.
 * The keyword developer fills in research() once a provider is chosen (the core team then adds it to ctx).
 */
import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator'
import { defineEngine, defineJob, EngineContext } from '../sdk'

class KeywordResearchInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  seed: string

  @IsString()
  @Length(2, 2)
  country: string

  @IsString()
  @Length(2, 2)
  language: string
}

export interface KeywordIdea {
  keyword: string
  /** Which provider produced it - metrics from different providers are never mixed. */
  source: string
  collectedAt: string
}

interface KeywordResearchResult {
  seed: string
  country: string
  language: string
  keywords: KeywordIdea[]
  note: string
}

async function research(ctx: EngineContext, input: KeywordResearchInput): Promise<KeywordResearchResult> {
  ctx.log.info('keyword research started', { seed: input.seed, country: input.country, language: input.language })
  ctx.progress(10, 'started')

  // Replace this stub: ask the chosen provider for ideas, then insert one `keyword` row per idea (see the migration).
  const keywords: KeywordIdea[] = []

  await ctx.db.query(
    `INSERT INTO research_run (project_id, job_id, seed, country, language, keyword_count) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (job_id) DO UPDATE SET keyword_count = EXCLUDED.keyword_count`,
    [ctx.projectId, ctx.jobId, input.seed, input.country.toUpperCase(), input.language.toLowerCase(), keywords.length]
  )
  ctx.progress(100)
  return { seed: input.seed, country: input.country.toUpperCase(), language: input.language.toLowerCase(), keywords, note: 'No keyword provider is connected yet.' }
}

export default defineEngine({
  id: 'keyword',
  concurrency: 2,
  jobs: {
    'keyword.research': defineJob({ input: KeywordResearchInput, handler: research, timeoutMs: 300_000, retries: 2 }),
  },
})
