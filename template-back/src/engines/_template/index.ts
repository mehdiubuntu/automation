/**
 * Starter for a new engine. Copy this folder to src/engines/<your-id>, then replace every `example` (here, in the
 * spec and in the migration) with your engine id: it is also your Postgres schema and the prefix of your job types.
 * Read ../CLAUDE.md first.
 */
import { IsString, MaxLength } from 'class-validator'
import { defineEngine, defineJob, EngineContext } from '../sdk'

class EchoInput {
  @IsString()
  @MaxLength(200)
  text: string
}

interface EchoResult {
  echoed: string
  attempt: number
}

async function echo(ctx: EngineContext, input: EchoInput): Promise<EchoResult> {
  ctx.log.info('echoing', { length: input.text.length })
  ctx.progress(50, 'halfway')
  // Writes into this engine's own schema. A retry hits the same job_id, so it never adds a second row.
  await ctx.db.query('INSERT INTO example_run (project_id, job_id) VALUES ($1, $2) ON CONFLICT (job_id) DO NOTHING', [ctx.projectId, ctx.jobId])
  return { echoed: input.text, attempt: ctx.attempt }
}

export default defineEngine({
  id: 'example',
  concurrency: 2,
  jobs: {
    'example.echo': defineJob({ input: EchoInput, handler: echo, timeoutMs: 30_000, retries: 1 }),
  },
})
