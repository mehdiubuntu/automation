# PROGRESS.md

## Status

2026-10-25, second change: on top of the lean auth layer the template now has **Postgres 18 with database-generated UUIDv7 ids**, **plain-SQL migrations that run automatically** (TypeORM `synchronize` is gone), a **background-job runtime** (a separate worker process, the queue is a Postgres table) and an **isolated `src/engines/` area** with starters for the audit, keyword and content engines, so other developers can build engines without touching the core. `CLAUDE.md` has the exact behaviour; `src/engines/CLAUDE.md` is the engine developers' guide.

Verified against a **real PostgreSQL 18.4** (an embedded build started from outside the repo; no Docker was available): integration specs for migrations, entity/SQL drift, the queue, the worker and the unit of work, plus an end-to-end smoke test with the built API and worker as two processes (register -> verify -> approve -> login -> project -> audit / keyword / content jobs -> cancel, idempotency, validation errors, the SSRF refusal, API and worker booting together on an empty database, the outbox dispatcher delivering on real Postgres for the first time). See "Not verified" below for what was not run.

## Baselines (measured 2026-10-25, after this change)

| Check | Result |
|---|---|
| `npm run build` | passes (copies the `.sql` migration files into `dist`) |
| `npm run dep-check` | 1 violation (known: `application.module.ts -> infrastructure.module.ts`), 230 modules |
| `npm run lint` | 44 errors / 0 warnings, all in inherited plumbing files; every new or touched file is lint-clean |
| `npm test` (no database) | 28 suites / 254 tests pass, 30 integration tests skipped |
| `TEST_DATABASE_URL=... npm test` (PostgreSQL 18) | 30 suites / 284 tests pass |
| front: `typecheck` / `lint` / `build` | 0 errors / 0 errors + 1 known warning / passes |

## Decisions (do not re-litigate)

Earlier, still valid:
- Auth is email + password + **email OTP** only. No OAuth/social, TOTP/2FA, passkeys, magic links, multi-profile, company selection or OTP-less reset.
- Roles are a fixed enum (`SUPERADMIN`, `SPARTAN`), no role/permission tables. The superadmin is defined by `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` and synced every boot; registration always creates a SPARTAN. `@Roles` + `RolesGuard` (fail closed) on top of `AuthGuard`.
- Status flow `PENDING_VERIFICATION -> PENDING_APPROVAL -> ACTIVE` (+ `BLOCKED`); `REQUIRE_APPROVAL=false` skips the approval step. Reject sets BLOCKED; block/reject revoke all sessions.
- No tenancy. `example-item` is project-scoped (`projectId` FK, name unique per project among live rows) and is the copy-me reference. Every active user sees every project.
- Project `code` is an immutable uppercase slug; name and code are unique among non-deleted rows. Deleting a project is a soft delete and does not cascade to items.
- `example-item` create AND list require the project to exist and be active (404 `PROJECT_001` / 409 `PROJECT_005`).
- OTP: 6 digits, HMAC-SHA256 hashed, 10 min, 5 attempts, single use, 60 s cooldown + 5/hour cap, one error (`AUTH_INVALID_OTP`) for every failure.
- Refresh tokens carry the session id (`sid`); a non-current token outside the 10 s grace revokes all the user's sessions.
- Anti-enumeration endpoints are padded to `ANTI_ENUMERATION_MIN_RESPONSE_MS`. CSRF: state-changing requests need an allowed `Origin`/`Referer`. `X-Forwarded-For` is never read (`TRUST_PROXY` controls proxy trust).
- Outbox payloads for OTP emails hold the plain code until delivery and are replaced with `{redacted:true}` once published. `AuthEvent` carries a nullable `actorUserId`.
- `@fastify/static` stays in dependencies (Swagger UI on Fastify needs it). Identity: package `template-back`, db `app_db`, user `app`, containers `app-postgres` / `app-redis`.

New in this change:
- **Ids:** every table's id is a UUIDv7 that Postgres 18 generates (`DEFAULT uuidv7()`); numeric ids are gone from the domain, DTOs (`@IsUUID()`), JWT `sub` and the front-end types. Only `Session` supplies its own id (it is inside the refresh token before the row exists): `SessionService` makes a v7 with the `uuid` package. Postgres 16 has no `uuidv7()`, so 18 is the minimum (`docker-compose.yaml`, CI).
- **Schemas:** `platform` (all core tables; it is the DataSource's default schema), `jobs` (the queue), and one schema per engine. `synchronize` is permanently `false`.
- **Migrations:** plain SQL, one folder per owner (core, jobs, each engine), numbered `0001_name.sql`, one transaction per file, recorded with a checksum in `platform.migration`. Applied files are immutable. Auto-applied at boot by `Migrator` under a Postgres advisory lock (`DB_AUTO_MIGRATE=true`, default); with it off the app refuses to boot while migrations are pending and `npm run migration:run` / `node dist/migrate.js` is the deploy step. Only engines in `ENGINES_ENABLED` are migrated. `database.int.spec.ts` fails when entities and SQL disagree.
- **Queue:** the table `jobs.job_run` itself (`FOR UPDATE SKIP LOCKED` claim, lease + heartbeat, retry with backoff, cancel, recovery of dead workers, retention purge) instead of pg-boss, which the earlier ADR 0002 had preferred. Reasons: one source of truth for queue and history, no second table to keep in sync, no new dependency, far fewer files, and enqueueing joins the caller's unit of work (proven by a spec: a job rolls back with a failed business write). `IJobQueue` is the seam if pg-boss is wanted later.
- **Worker:** `src/worker.ts`, same image (`node dist/worker.js`), loads only config + database + the job runtime (no auth stack, seeders or crons). No `bufferLogs` (Nest never flushes it for a non-HTTP context, the worker would be silent).
- **Engines:** `src/engines/<id>/`, written by other developers against `src/engines/sdk.ts` only. Core lists them in `src/engines/index.ts`; `ENGINES_ENABLED` (required in production) switches them on; `WORKER_ENGINES` gives an engine its own worker. Starters: `audit` (real on-page HTML checks), `keyword` and `content` (stubs until providers are chosen), `_template` (the copy-me).
- **Walls around engines (isolation level "A": same repo, enforced by rules):** dependency-cruiser (own files + SDK only; nothing outside imports engine files), ESLint (no Node I/O, `process`, `fetch`, `console`, DB drivers, Nest, core aliases), SQL guard (own schema only, also in migrations), `ctx.http` refuses private/internal addresses at connect time, CODEOWNERS and an `engine-guard` CI job that fails a pull request from an engine developer touching anything outside their folder. These stop mistakes; they are not a sandbox (see below).
- Jobs are a deliberate exception to "a slice in all four layers" (see `CLAUDE.md`): contract in `domain/job`, one use-case, one generic controller, the runtime in `infrastructure/jobs`.

## Added / changed

New: `domain/job`, `application/job`, `presentation/api/v1/job`, `infrastructure/jobs/*` (queue, worker, registry, context, http, SQL), `infrastructure/database/migrator.ts` + `migrations/`, `infrastructure/config/jobs`, `src/worker.ts`, `src/migrate.ts`, `src/engines/*`, `.github/CODEOWNERS` and `.github/workflows/ci.yml` (repo root). Changed: every id (number -> uuid string) across domain, application, infrastructure, presentation, fakes and specs; `typeorm.config` (schema, no sync), `database.config`, `docker-compose.yaml` (Postgres 18), `Dockerfile` (comment), `nest-cli.json` (SQL assets), `tsconfig.json` + jest (`@engines/*`), `package.json` (scripts), the dependency-cruiser and ESLint configs, `.env.development.default`. Removed: `DB_ALLOW_SYNC_WITH_TYPEORM`.

## Not verified

- The Docker image build and the compose stack were not run (no Docker daemon here); the Postgres 18 volume path (`/var/lib/postgresql`) is per the image documentation but untested.
- A real SIGTERM graceful shutdown was not exercised (Windows does not deliver it); the same code path is covered by a spec that calls the shutdown hook.
- CODEOWNERS and the CI workflow never ran on GitHub. The `engine-guard` shell logic was tested locally with sample inputs. The `YOUR-ORG` / `REPLACE-*` placeholders must be replaced and branch protection switched on, or none of it is enforced.
- The front-end was typechecked, linted and built but not driven in a browser against the live back-end.
- In-process isolation is not a security boundary: code running in the same Node process can still do anything Node can. For authors you do not trust, run engines in their own process or container with their own database credentials (the `ctx` contract makes that a move, not a rewrite).

## Next steps

1. Replace the CODEOWNERS / CI placeholders with real GitHub teams and logins and enable branch protection; give each developer their engine.
2. Choose the providers (keyword data, AI text, PageSpeed) and expose them to engines as ports on `ctx`, written and reviewed by the core team.
3. Front-end: a jobs screen (start, progress, result) over the four generic job endpoints; port a markdown editor and charts lazily when Content and Reporting need them.
4. Move the two crons (auth cleanup, outbox dispatcher) from the API into the worker; optional hardening: one database role per engine.
5. Add e2e tests for the auth flow, role denial, session revocation and CSRF against the real database (the throw-away smoke script used for this verification is not kept in the repo).

STOPPED AT: runtime, migrations, engine starters and docs are complete and verified on PostgreSQL 18; next step is item 1 (placeholders and branch protection) before handing the engines out.
