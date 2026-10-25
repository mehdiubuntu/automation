# Engines - read this before you touch anything here

An **engine** is one self-contained kind of background work: audit, keyword research, article generation... You build one engine in `src/engines/<id>/`. **You change nothing outside your folder.** CI fails a pull request from an engine developer that touches any other file, and CODEOWNERS sends it to the core team.

## What is yours, what is not
- **Yours:** everything under `src/engines/<id>/` - `index.ts`, `index.spec.ts`, `migrations/*.sql`, and any files you add beside them.
- **Core team's (never edit):** `sdk.ts`, `index.ts` and this file in `src/engines/`, `_template/`, everything else in `src/`, `package.json`, `test/`, `.github/`.
- Need something from the core side (an npm package, an AI / keyword / CMS provider, a new field on `ctx`)? Ask the core team. Do not work around it.

## How a job runs
1. `POST /api/v1/job/run-job` with `{ type: '<id>.<name>', projectId, input }`. The API checks the user and project, validates `input` against your input class, and queues the job. You write no controller, DTO or guard.
2. A worker process (`npm run worker:dev`) calls your handler with a `ctx`. You never see HTTP, users, sessions or other engines.
3. What the handler returns is saved as the job result (JSON, at most 1 MB). The UI reads `GET /api/v1/job/get-job/:id`.

Delivery is **at least once**: a handler can run again after a crash, a timeout or a retry. Make it safe to repeat (see Idempotency).

## Create an engine
1. Copy `_template` to `src/engines/<id>`. The id is lower-case letters, digits and `_`, 2-31 characters, and it is also your Postgres schema and the prefix of your job types.
2. Replace `example` with your id in `index.ts`, `index.spec.ts` and the migration.
3. Describe each job with `defineJob({ input, handler, timeoutMs?, retries? })` and list them in `defineEngine({ id, concurrency?, jobs })`. Job types are `<id>.<name>`.
4. Write the handlers using only `ctx`; test them with `testEngine(engine, 'id.job', input, { http, db })`.
5. The core team adds the engine to `src/engines/index.ts` and to `ENGINES_ENABLED`. Until then it never runs in production.

Run your tests with `npx jest src/engines/<id>`. To try it for real: `docker compose up -d`, then `npm run start:dev` and `npm run worker:dev` in two terminals (all engines are enabled by default in development), and call `run-job`.

## Your toolbox: `ctx`
| | |
|---|---|
| `ctx.jobId`, `jobType`, `projectId`, `attempt` | who and what this run is. `attempt` is 1, then 2 after a retry... Store `projectId` on every row you write. |
| `ctx.http.get(url)`, `postJson(url, body)` | public http(s) only. Private, loopback and cloud-metadata addresses are refused, redirects included. 15 s timeout, 2 MB response cap (options override both). An error status (404...) is returned, not thrown. |
| `ctx.db.query(sql, params)`, `ctx.db.tx(fn)` | plain SQL, parameters as `$1, $2`. Your schema is the default, so write `FROM audit_run`, not `FROM audit.audit_run`. SQL that names another schema is refused. `tx` runs several statements atomically. |
| `ctx.log.info / warn / error` | the only way to log. Never `console.log`. |
| `ctx.progress(percent, note?)` | shows progress in the job (throttled to about one write a second). |
| `ctx.signal` | aborted when the job is cancelled or times out. Check it in long loops and pass it on. |

## Data
- Your tables live in your own schema, created for you. Put SQL in `migrations/0001_name.sql`, `0002_...`, in order. **A merged migration is never edited** - add a new numbered file. Applied files are checksummed; changing one stops the app from booting.
- Write plain unqualified SQL. Never reference another schema, change `search_path`, or `CREATE SCHEMA / ROLE / EXTENSION` - such files are refused. Ids default to `uuidv7()`.
- You cannot read core tables (users, projects...). The core already verified the project exists and is active.

## Idempotency and errors
- Give your result rows a unique key that includes `job_id` (see `audit_run`) and write with `ON CONFLICT (job_id) DO ...`, so a retry replaces instead of duplicating.
- Something that already happened outside (a post that was published) must be checked before you do it again.
- A thrown error is retried with backoff (30 s, 60 s, ... up to `retries`). `throw new EngineError('why', false)` fails the job at once - use it for input that can never work.
- Defaults: timeout 5 min (max 1 h), retries 2 (max 10), concurrency 2 per worker (max 20).

## Rules (lint, dependency-cruiser and CI enforce them)
- Import only `../sdk`, your own files, and plain packages already in `package.json` (`class-validator`, `class-transformer`, `crypto`, ...).
- Not allowed: `fs`, `http(s)`, `net`, `child_process`, `os`, `pg`, `typeorm`, `axios`, any `@nestjs/*`, `@domain` / `@application` / `@infrastructure` / `@presentation` aliases, another engine, `process.env`, global `fetch`, `eval`, `console`.
- Configuration and secrets come from the core team through `ctx`, never from the environment.
- No new libraries. If one is really needed, ask.
