# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`template-back` is a reusable **hexagonal NestJS 11 + Fastify starter** with a lean, secure authentication layer. Persistence is **TypeORM + PostgreSQL**; Redis (ioredis) is optional (off by default). All user-facing text (error messages, Swagger summaries, validator messages, email templates) is **English** - do not introduce any other language.

It ships: email + password authentication with **email OTP verification**, **password reset by OTP**, multi-session management with refresh rotation and reuse detection, **two fixed roles** (`SUPERADMIN`, `SPARTAN`), an env-defined super administrator, optional admin approval of new accounts, an auth audit trail, a transactional outbox with email delivery, a health endpoint, a **background-job runtime** (a separate worker process running pluggable **engines**, see `src/engines/CLAUDE.md`), SQL migrations that run automatically, and two reference slices:

| Reference | Kind | Copy it when the new feature is... |
|---|---|---|
| **`example-item`** | project-scoped (`projectId` FK, name unique per project, soft delete) | business data that belongs to one `Project` (almost everything) |
| **`project`** | flat global entity (no ownership), superadmin-only writes | platform-level data every user can read |

There is **no tenancy**: no companies, no per-company roles, no permission tables. Every user sees every project. Every endpoint sits behind `AuthGuard` + `RolesGuard` unless it is deliberately public (auth entry points, health).

## On session start - read `PROGRESS.md`

`PROGRESS.md` (repo root) is the running log: status, baselines, decisions, next steps. **Read it before starting work and never re-litigate a decision recorded there.** Updating it is part of "done": record every finished feature, decision, and (at session end) `STOPPED AT: <file> + next step`.

## Commands

```bash
npm run start:dev      # watch mode, NODE_ENV=development -> reads .env.development
npm run start:debug    # same + --inspect
npm run build          # nest build (NODE_ENV=production) -> dist/
npm run start:prod     # node dist/main.js
npm run worker:dev     # the background worker (watch mode); production: npm run start:worker:prod = node dist/worker.js
npm run migration:run  # apply pending SQL migrations and exit (production: migration:run:prod); --status only lists them
npm run lint           # eslint --fix (also reformats via the prettier plugin)
npm run format         # prettier --write
npm run test           # jest (testRegex .*\.spec\.ts$, rootDir src). The *.int.spec.ts files need a real PostgreSQL 18: set TEST_DATABASE_URL
                       # (e.g. postgres://app:app123456@localhost:5432/postgres); without it they are skipped.
npm run dep-check      # dependency-cruiser - enforces the layer boundaries below
```

`NODE_ENV` selects the env file via `envFilePath: .env.${NODE_ENV || 'development'}`. `.env.development.default` is the committed template (every key documented); copy it to `.env.development` (dev credentials only - never commit real secrets). App port is `APP_PORT` (default **5000**); global prefix `api`, so every route is `/api/v1/...`. Swagger UI is at `/api` when `SWAGGER_ENABLED=true`.

**Local infra:** `docker compose up -d` starts **postgres** (**18**-alpine, `:5432`, db `app_db`, user `app` / `app123456`; 18 is required because every id defaults to its built-in `uuidv7()`) and **redis** (7-alpine, `:6379`, only used when `REDIS_ENABLED=true`). TypeORM `synchronize` is **permanently off**: the schema changes only through the SQL migrations below, applied automatically when the API or the worker boots (`DB_AUTO_MIGRATE=true`).

**Dev OTP codes:** with `EMAIL_ENABLED=false` the `LogEmailSender` prints the 6-digit code in the app log (`[dev email] verification code for ...`). That is the only place a code is ever logged, and production refuses to boot in this mode.

## Architecture - strict hexagonal, four layers, feature slices

Everything lives under `src/`, one folder per layer, each with a TS path alias. **Dependencies flow inward only**, enforced by `npm run dep-check` (`test/.dependency-cruiser.js`):

| Alias | Folder | May depend on | Holds |
|---|---|---|---|
| `@domain/*` | `src/domain/` | domain only | Aggregates, enums, policies, and **interfaces**: `repository/` (with a `*_TOKEN`), `contract/` ports, shared error/pagination/unit-of-work contracts. No NestJS/TypeORM imports (except the `HttpException` base used by `GenericException`). |
| `@application/*` | `src/application/` | application, domain | `use-case/` classes (business orchestration), `service/` helpers, `I*Input` interfaces, outbox handlers. |
| `@infrastructure/*` | `src/infrastructure/` | infra, application, domain | TypeORM `orm-entity/` + `mapper/` + `repository/` impls, config factories, JWT/bcrypt/OTP adapters, email senders, redis, schedulers, boot seeder, db-error mapper. |
| `@presentation/*` | `src/presentation/` | all layers | `api/v1/<feature>/end-point/` controllers + `dto/`, plus global filters/interceptors/hooks/guards/validators under `common/`. |

Each **feature** is a same-named folder across all four layers (a vertical slice):

```
src/domain/project/                  aggregate/ repository/ (interface + PROJECT_REPOSITORY_TOKEN)
src/application/project/             use-case/ interface/ (I*Input) [testing/ = in-memory fakes, excluded from the build]
src/infrastructure/database/project/ orm-entity/ mapper/ repository/
src/presentation/api/v1/project/     end-point/ dto/
```

Slices present: `auth` (use-cases + services over the `user`, `otp`, `session`, `auth-event` persistence slices), `user` (super-admin operations), `project`, `example-item`, `outbox`, `email` (transactional senders), `health`.

**Composition root** is `PresentationModule` - imports `ApplicationModule` + `AsyncContextModule` + `InfrastructureModule` + `ThrottlerModule`; registers controllers, the global `APP_PIPE` (ValidationPipe: `whitelist + forbidNonWhitelisted + transform`), `APP_FILTER` (`GlobalExceptionFilter`), `APP_INTERCEPTOR`s (`SuccessLoggerInterceptor`, `ResponseInterceptor`), `APP_GUARD` (`AppThrottlerGuard`) and the Fastify hooks (`CorrelationIdHook`, `CsrfOriginHook`). `AppModule` only loads the global `ConfigModule` + `PresentationModule`. `src/main.ts` registers Fastify plugins (helmet, cors, cookie), an empty-body-tolerant JSON parser, the body limit, sets prefix `api`, and calls `initializeTransactionalContext()` first thing - it must run before any repository is used. (`@fastify/static` must stay in deps: `@nestjs/swagger` lazy-loads it to serve the Swagger UI on Fastify.)

### Dependency injection is token-based (ports & adapters)

- The **interface + token** live in domain: `export const PROJECT_REPOSITORY_TOKEN = Symbol(...); export interface IProjectRepository { ... }`.
- The **implementation** lives in infrastructure, wired in `src/infrastructure/infrastructure.module.ts`: `{ provide: PROJECT_REPOSITORY_TOKEN, useClass: ProjectRepositoryImpl }`, token re-exported.
- Use-cases inject by token: `@Inject(PROJECT_REPOSITORY_TOKEN) private readonly repo: IProjectRepository` (use `import type` / `type` import for the interface).
- Ports beyond repositories: `PASSWORD_HASHER_TOKEN`, `TOKEN_PROVIDER_TOKEN`, `OTP_CODE_PROVIDER_TOKEN`, `EMAIL_SENDER_TOKEN`, `UNIT_OF_WORK_TOKEN`, `HEALTH_PROBE_TOKEN`, and `AUTH_SETTINGS_TOKEN` (the env-resolved tunables, an `IAuthSettings` literal in tests).

Wiring a new feature: add the ORM entity to `TypeOrmModule.forFeature([...])` and the `{ provide: TOKEN, useClass: Impl }` binding (+ export) in `infrastructure.module.ts`; register the use-case in `application.module.ts` (providers **and** exports); add the controller to `presentation.module.ts`'s `controllers`.

### ORM entity <-> domain aggregate, via an explicit Mapper

Domain aggregates (`project.aggregate.ts`) are plain classes with static `create(props)` / `restore(...)` factories and `toPrimitives()` - no ORM decorators. ORM entities (`*.orm.entity.ts`, extending `BaseOrmEntity`: a uuid `id` that Postgres generates + createdAt/updatedAt/deletedAt `timestamptz` columns) are separate (`Session` and `AuthEvent` define their own key/timestamps). A static **`XxxMapper`** converts both ways (`toDomain`/`toOrm`) and maps semantic domain enums to int DB columns (`UserMapper`, `OtpMapper`, `AuthEventMapper`). **Repositories always return domain aggregates via the mapper, never raw ORM rows.** The `User` aggregate's `password` is only populated by `findByEmailWithPassword` / `findByIdWithPassword`, and `User.toPrimitives()` never carries it.

**Partial-update gotcha:** with this tsconfig, ORM entity class fields are own-properties even when unset, so passing a `toOrm()` instance straight to an update writes NULLs. Build the update payload by filtering `undefined` entries first (see `ProjectRepositoryImpl.updateById`). For the same reason, aggregate `create()` factories must not default fields (e.g. `active ?? true`) - DB column defaults cover inserts, and a patch must not silently overwrite.

### Transactions - the Unit of Work

Multi-write use-cases wrap work in `this.uow.execute(async () => { ... })` (`UNIT_OF_WORK_TOKEN` -> `TypeOrmUnitOfWork`, backed by `typeorm-transactional`). The DataSource is registered once in `infrastructure.module.ts` (`addTransactionalDataSource`, idempotent). Validation that can reject the whole operation runs **before** `uow.execute` so a rejected request writes nothing. Counters that must survive a failed request (OTP attempts, failed-login counter) are deliberately written **outside** the unit of work.

## Database: ids, schemas and migrations

- **Ids are UUIDv7 generated by Postgres 18** (`DEFAULT uuidv7()`, time-ordered). ORM entities extend `BaseOrmEntity` (`@PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })`); the app never assigns an id on insert and TypeORM reads it back. Domain ids are `string`, DTOs validate them with `@IsUUID()`. The one exception is `Session`: its id travels inside the refresh token before the row exists, so `SessionService` makes it (`uuid` v7).
- **One Postgres schema per owner:** `platform` = every core table (it is the TypeORM DataSource's default schema, so entities need no `schema:` option), `jobs` = the job queue, and one schema per engine, named after the engine id. Core tables keep TypeORM's names (`"platform"."User"`, camelCase columns); the plain-SQL schemas (`jobs`, engines) use snake_case.
- **Migrations are plain SQL files**, one folder per owner: `src/infrastructure/database/migrations/` (core), `src/infrastructure/jobs/migrations/` (jobs), `src/engines/<id>/migrations/` (an engine). Names are `0001_what_it_does.sql`, applied in order, each in its own transaction and recorded in `platform.migration` with a checksum. **A merged file is never edited** (the app refuses to boot if an applied file changed): add the next number. Each file runs with `search_path` set to its owner's schema, which is created on demand. Engine files may not name another schema or touch roles, extensions or `search_path`.
- **Auto-migration:** `Migrator` (an `OnModuleInit` provider, in `InfrastructureModule` and in the worker) applies everything pending at boot behind a Postgres advisory lock, so the API and the worker booting together never collide. `DB_AUTO_MIGRATE=false` turns it off: the app then refuses to start while migrations are pending, and a deploy step runs `npm run migration:run` (`node dist/migrate.js`) instead. Only the engines in `ENGINES_ENABLED` are migrated. The Nest build copies the `.sql` files into `dist` (`nest-cli.json` assets).
- **Adding or changing a core entity means writing a migration** (the next numbered file in `src/infrastructure/database/migrations/`). `database.int.spec.ts` compares the entities with the migrated schema and fails on any difference, so a forgotten migration cannot reach main. To draft the SQL, point TypeORM's `createSchemaBuilder().log()` at a database migrated up to the previous file and copy the statements.

## Background jobs and engines

Slow or side-effecting work never runs in the API: it becomes a **job** that a **worker** process runs through an **engine**.

- **Flow:** `POST /api/v1/job/run-job` -> `JobUseCase` checks that the job type is enabled, validates the input with the engine's input class and checks the project (404 `PROJECT_001` / 409 `PROJECT_005`) -> a row in `jobs.job_run` (that table *is* the queue; no queue library) -> a worker claims it (`FOR UPDATE SKIP LOCKED`, so any number of workers can run side by side) -> the engine handler runs with a `ctx` -> result, error and progress are written back. Delivery is at-least-once, so handlers must be idempotent.
- **Where the code lives** (a deliberate exception to "a slice in all four layers", to keep the runtime in few files): `domain/job/job.contract.ts` (statuses, `JobRun`, the `IJobQueue` and `IEngineCatalog` ports), `application/job/job.use-case.ts`, `presentation/api/v1/job/` (one generic controller, so engine developers write no controllers), and the runtime in `infrastructure/jobs/`: `job-queue.ts` (every SQL statement on `job_run`), `job-worker.ts` (poll loop, heartbeat lease, timeout, retry with backoff 30 s x 2^n up to 10 min, cancel, graceful shutdown), `engine-registry.ts` (validates every engine at boot; `ENGINES_ENABLED`), `engine-context.ts` (builds the `ctx`), `engine-http.ts` (outbound HTTP that refuses private and internal addresses). Entry points: `src/worker.ts` (no HTTP, no auth stack, no crons) and `src/migrate.ts`.
- **Worker:** the same image as the API, started as `node dist/worker.js`. `WORKER_ENGINES=audit` gives a heavy engine a worker of its own; `ENGINES_ENABLED` (required in production) is the release switch. A running job holds a lease that a heartbeat extends; if the worker dies the lease expires and another worker takes the job over. SIGTERM stops claiming, lets running jobs finish for `WORKER_SHUTDOWN_GRACE_SECONDS`, then hands the rest back to the queue without charging an attempt. The crons (auth cleanup, outbox dispatcher) still run inside the API.
- **Engines** live in `src/engines/<id>/` and are written by other developers. They import only `src/engines/sdk.ts` (the contract: `defineEngine`, `defineJob`, `EngineContext`, `testEngine`); the core team lists them in `src/engines/index.ts`. The walls: dependency-cruiser (an engine may import only its own files and the SDK; nothing outside imports an engine's files), ESLint (no Node I/O modules, `process`, `fetch`, DB drivers, Nest, core aliases, `console`), a SQL guard (own schema only), CODEOWNERS and the `engine-guard` CI job. **Do not weaken these rules.** The engine-developer guide is `src/engines/CLAUDE.md`.
- To start a job from another use-case later, add a small port in domain (use-cases cannot import `infrastructure/jobs`); `IJobQueue.enqueue` joins the caller's unit of work.

## Authentication

Email + password only. No OAuth/social, no TOTP/2FA, no passkeys, no magic links.

### Roles (fixed enum, no tables)

| Role | Can |
|---|---|
| `SPARTAN` | everything on project work: all `example-item` endpoints, read projects, manage own sessions/password |
| `SUPERADMIN` | everything a SPARTAN can, plus create/update/delete projects, approve/reject/block/unblock users, read any user's sessions/audit trail, outbox monitoring |

The **super administrator is defined by env** (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`). `SuperAdminBootstrapUseCase` (run by `SuperAdminSeeder` on every boot, idempotent) upserts that user as `SUPERADMIN`, `ACTIVE`, email verified, re-syncs the bcrypt hash when the env password changed (and then revokes its sessions), clears any lock, and **demotes any other SUPERADMIN** to SPARTAN. A startup failure aborts boot. Nobody can register as superadmin: `register` always creates a SPARTAN, and registering with the superadmin email returns the same generic 202 as any duplicate. The superadmin cannot be blocked/rejected/modified through the API (`USER_003`), cannot use forgot-password (silently ignored) and cannot change its password through the API (`AUTH_PASSWORD_MANAGED_BY_ENV`).

Enforcement is a plain decorator + guard: `@UseGuards(AuthGuard, RolesGuard)` (class level) and `@Roles(UserRole.X, ...)` (class or handler; handler wins). **`RolesGuard` fails closed**: a route with no `@Roles` is denied (403 `AUTH_FORBIDDEN`), so forgetting the decorator can never open a route.

### User status

`PENDING_VERIFICATION` -> (verify email OTP) -> `PENDING_APPROVAL` -> (superadmin approves) -> `ACTIVE`; with `REQUIRE_APPROVAL=false` verification goes straight to `ACTIVE`. `BLOCKED` is set by reject/block and undone by unblock (-> `ACTIVE`). Only `ACTIVE` can use the API; blocking or rejecting revokes every session of the user immediately. Allowed admin transitions: approve `PENDING_APPROVAL`; reject `PENDING_APPROVAL`; block `ACTIVE`/`PENDING_APPROVAL`; unblock `BLOCKED` (anything else is 409 `USER_002`).

### Final endpoint list (`/api/v1`)

Envelope on every response: `{ success, message, statusCode, data, error }`; lists use `data: { data: [...], meta: { itemsPerPage, totalItems, currentPage, totalPages } }`.

Auth (public unless noted; cookies `accessToken` + `refreshToken`, HttpOnly, SameSite=Lax, `Secure` in prod; bodies never contain tokens):

| Method + path | Body / query | Success `data` |
|---|---|---|
| `POST /auth/register` | `{email, password}` | **202** `{message}` (generic, identical for new/duplicate/superadmin email) |
| `POST /auth/verify-email` | `{email, code}` (6 digits) | 200 `{status}` = `PENDING_APPROVAL` or `ACTIVE` |
| `POST /auth/resend-verification` | `{email}` | **202** `{message}` (same generic body) |
| `POST /auth/login` | `{email, password}` | 200 `{user:{id,email,role,status}}` + cookies |
| `POST /auth/refresh` | (cookie) | 200 `{refreshed:true}` + rotated cookies |
| `POST /auth/logout` | (cookies; no guard, works with an expired access token) | 200 `{loggedOut:true}`, cookies cleared |
| `POST /auth/logout-all` | auth | 200 `{revoked}`, cookies cleared |
| `GET /auth/me` | auth | `{id,email,role,status}` |
| `POST /auth/forgot-password` | `{email}` | **202** `{message}` (generic) |
| `POST /auth/reset-password` | `{email, code, newPassword}` | 200 `{reset:true}`; ALL sessions revoked |
| `POST /auth/change-password` | auth; `{currentPassword, newPassword}` | 200 `{changed:true}`; all OTHER sessions revoked |
| `GET /auth/sessions` | auth | `[{id (uuid), deviceLabel, ip, createdAt, lastActiveAt, isCurrent}]` |
| `DELETE /auth/sessions/:id` | auth; own session only | 200 `{revoked:true}` (another user's id is 404 `AUTH_SESSION_NOT_FOUND`); revoking the current one clears the cookies |
| `POST /auth/sessions/revoke-others` | auth | 200 `{revoked}` |

User administration (SUPERADMIN):

| Method + path | Notes |
|---|---|
| `GET /user/get-users?status=&search=&page&limit&order` | paginated `{id,email,role,status,emailVerifiedAt,createdAt}` |
| `POST /user/approve-user/:id`, `reject-user/:id` (-> BLOCKED), `block-user/:id`, `unblock-user/:id` (-> ACTIVE) | return the updated user item |
| `GET /user/get-user-sessions/:userId` | `[{id,deviceLabel,ip,createdAt,lastActiveAt,userAgent}]` |
| `POST /user/revoke-user-sessions/:userId` | `{revoked}`; not allowed on the superadmin |
| `GET /user/get-auth-events?userId=&type=&page&limit&order` | paginated `{id,userId,actorUserId,type,ip,userAgent,createdAt}` |

Projects: `POST /project/create-project {name, code?, description?}` [SUPERADMIN]; `GET /project/get-projects?search=&isActive=&page&limit&order` and `GET /project/get-project/:id` [any active user]; `PUT /project/update-project/:id {name?, description?, isActive?}` and `DELETE /project/delete-project/:id` (soft) [SUPERADMIN]. Item `{id,name,code,description,isActive,createdAt,updatedAt}`; `code` is an immutable uppercase slug (derived from the name when omitted); name and code are unique among non-deleted projects.

Example items (SPARTAN + SUPERADMIN): `/example-item/create-example-item` (body `projectId` required), `get-example-items` (query `projectId` required; filters `name`, `isActive`), `get-example-item/:id`, `update-example-item/:id`, `delete-example-item/:id`. Item `{id,projectId,name,description,isActive}`. The project must exist and be active for create and list.

Outbox monitoring (SUPERADMIN): `/outbox/get-outbox-messages`, `get-outbox-health`, `get-outbox-message/:id`, `retry-outbox-message/:id`, `bulk-retry-outbox-messages`, `cancel-outbox-message/:id`. `GET /health` is public.

Jobs (SPARTAN + SUPERADMIN; one generic surface for every engine): `POST /job/run-job {type, projectId, input, idempotencyKey?}` (answers at once with the queued job), `GET /job/get-jobs?projectId=&engine=&status=&page&limit&order` (newest first), `GET /job/get-job/:id` (status, progress, result or error), `POST /job/cancel-job/:id`. Job `{id, engine, type, projectId, requestedBy, input, status (queued|running|succeeded|failed|cancelled), attempts, maxAttempts, progress, progressNote, result, error, cancelRequested, correlationId, runAt, createdAt, startedAt, finishedAt}`; a failed attempt that will be retried is `queued` again with a later `runAt`.

### Error codes (`error.errorCode`)

Auth codes are descriptive and **stable - the frontend switches on them**:

| Code | HTTP | Meaning |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | unknown email or wrong password (one generic error for both, same timing) |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 | right password, status `PENDING_VERIFICATION` |
| `AUTH_PENDING_APPROVAL` | 403 | right password, status `PENDING_APPROVAL` |
| `AUTH_BLOCKED` | 403 | right password, status `BLOCKED` |
| `AUTH_LOCKED` | 403 | right password, account temporarily locked after repeated failures |
| `AUTH_INVALID_OTP` | 400 | wrong / expired / used / attempts-exhausted / unknown-email code - always the same error |
| `AUTH_INVALID_SESSION` | 401 | no/invalid/expired/revoked session, user no longer ACTIVE, refresh token reuse |
| `AUTH_SESSION_NOT_FOUND` | 404 | session id is not one of yours |
| `AUTH_FORBIDDEN` | 403 | authenticated but the role is not allowed |
| `AUTH_INVALID_CURRENT_PASSWORD` | 400 | change-password: current password wrong |
| `AUTH_PASSWORD_REUSED` | 400 | change-password: new equals current |
| `AUTH_WEAK_PASSWORD` | 400 | new password fails the policy (reset/change) |
| `AUTH_PASSWORD_MANAGED_BY_ENV` | 403 | the superadmin password is changed in the environment |
| `AUTH_ORIGIN_NOT_ALLOWED` | 403 | CSRF origin check |
| `AUTH_RATE_LIMITED` | 429 | per-IP rate limit |

Other modules use `MODULE_NNN`: `USER_001` not found, `USER_002` invalid status transition, `USER_003` superadmin protected, `PROJECT_001` not found / `002` name taken / `003` code taken / `004` no code derivable / `005` not active, `EXAMPLE_ITEM_001` not found / `002` name taken in project, `OUTBOX_001`-`004`, `JOB_001` unknown or disabled job type / `002` not found / `003` invalid input / `004` already finished. Request-validation failures are 400 with `message: "validation"` and a list of field messages. Postgres unique violations (23505) are auto-mapped to a 409 by `DatabBaseExceptionMapper`.

### OTP rules (`OtpService`, purposes `EMAIL_VERIFICATION` and `PASSWORD_RESET`)

- 6 digits from `crypto.randomInt`; stored only as **HMAC-SHA256** keyed with `OTP_HMAC_SECRET` over `purpose:userId:code` (a code for one purpose/user can never satisfy another); compared in constant time.
- Valid `OTP_TTL_MINUTES` (10); **dead after `OTP_MAX_ATTEMPTS` (5) wrong guesses** (the counter is incremented atomically before comparing, so parallel guesses all count); single use (atomic consume inside the unit of work); issuing a new code invalidates the older ones.
- Resend cooldown `OTP_RESEND_COOLDOWN_SECONDS` (60) and `OTP_HOURLY_CAP` (5) per user and purpose; when either blocks, the endpoint still answers its generic 202 and sends nothing.
- Anti-enumeration: register / resend-verification / forgot-password always return the same 202 body and are padded to at least `ANTI_ENUMERATION_MIN_RESPONSE_MS`; verify/reset for an unknown, wrong-status or code-less account run the same dummy work and return the same `AUTH_INVALID_OTP`. Forgot-password only sends to `ACTIVE`/`PENDING_APPROVAL` non-superadmin accounts.

### Sessions and tokens

- **Access JWT** `{sub, role, sid}` (15 min) + **refresh JWT** `{sub, sid, jti}` (`JWT_REFRESH_EXPIRES_SECONDS`), both in HttpOnly cookies. The role in the token is informational: `AuthGuard` re-reads the user from the database (5 s in-process cache) and requires `ACTIVE`, so a blocked user loses access at once (blocking also revokes their sessions).
- **One `Session` row per login** (`id` uuid, `userId`, `refreshTokenHash` sha256, `rotatedFrom`, `rotatedAt`, `ip`, `userAgent` truncated to 255, `deviceLabel` parsed from the UA, `createdAt`, `lastActiveAt` touched at most once a minute, `expiresAt`, `revokedAt`). A session is live while not revoked, before `expiresAt` (sliding, one refresh lifetime), inside `SESSION_ABSOLUTE_LIFETIME_SECONDS` of its creation, and (if `SESSION_IDLE_TIMEOUT_SECONDS` > 0) not idle too long. `MAX_SESSIONS_PER_USER` (10): the oldest live sessions are revoked beyond it.
- **Refresh rotation with reuse detection**: each refresh swaps the stored hash (compare-and-swap) and keeps the replaced hash in `rotatedFrom`. Presenting any non-current refresh token of a live session outside `REFRESH_GRACE_SECONDS` (10) is treated as theft: **all of that user's sessions are revoked** (401 `AUTH_INVALID_SESSION`). Inside the grace window (parallel refreshes from one browser) only a fresh access cookie is issued and nothing is revoked.
- Password change revokes all other sessions; reset revokes all; logout revokes the current one; logout-all / revoke-others as listed. Revoked rows are kept 7 days for replay detection, then purged by `AuthCleanupCronJob`.

### Security measures

- **Passwords**: bcrypt, cost `PASSWORD_SALT_ROUNDS` >= 12 (boot fails below). Any password a user *chooses* must satisfy `domain/auth/policy/password.policy.ts` (`@IsSecurePassword()`: 8+ chars, 72 **bytes** max because bcrypt truncates, lower + upper + digit + special); login DTOs deliberately have no policy. Emails are trimmed + lower-cased (`@NormalizedEmail()`, `normalizeEmail`), validated and capped at 254.
- **Login**: unknown email does a dummy bcrypt compare (precomputed at boot). Distinct failure reasons (`AUTH_EMAIL_NOT_VERIFIED`, ...) are only returned after the password was verified. **Lockout**: `LOGIN_MAX_FAILED_ATTEMPTS` (5) wrong passwords -> locked `LOGIN_LOCKOUT_MINUTES` (15); the counter is an atomic DB increment, reset on success; while locked a wrong password still gets the generic error (and does not extend the lock) and only the correct password learns `AUTH_LOCKED`.
- **Rate limiting** (`@nestjs/throttler`, per IP, in memory per instance): `@RateLimit('register'|'login'|'resend'|'verifyOtp'|'refresh'|'sensitive')` puts a handler under its own env-tunable bucket (`RATE_LIMIT_<NAME>_LIMIT` / `_TTL_SECONDS`); every untagged route shares the generous `global` bucket. A refused request is 429 `AUTH_RATE_LIMITED`. `TRUST_PROXY=true` only behind a proxy you control (otherwise `X-Forwarded-For` would let clients pick their own rate-limit key); `request.ip` is the only IP source anywhere.
- **CSRF**: cookies are the credential, so `CsrfOriginHook` rejects state-changing requests (non GET/HEAD/OPTIONS) whose `Origin` (else `Referer`) is not in `CORS_ORIGINS` (403 `AUTH_ORIGIN_NOT_ALLOWED`). With neither header, only cookie-less callers (curl, server-to-server) pass; a cookie-bearing request without them is refused. Send `Origin` from non-browser clients that use cookies.
- **Headers / CORS / limits**: `@fastify/helmet` (CSP is relaxed only while Swagger is enabled), strict credentialed CORS from `CORS_ORIGINS` (exact origins, no `*`, required in production), body limit `BODY_LIMIT_BYTES` (100 KB), ValidationPipe `whitelist + forbidNonWhitelisted`.
- **No secrets in logs**: the exception filter logs request payloads through `redactSensitive` (passwords, codes, tokens removed, emails masked); the success logger logs method/path/status only; SMTP logs the message id, not the recipient. The OTP code reaches the outbox payload only because the email needs it: the payload is **never** exposed by outbox monitoring (`toOperationalView`), and the dispatcher replaces it with `{redacted:true}` the moment delivery succeeds.
- **Fail-fast config** (`AuthConfig`, `AppConfig`, `EmailConfig`): missing/short (< 32) `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `OTP_HMAC_SECRET` (the three must differ), missing/invalid `SUPERADMIN_EMAIL`, missing/weak `SUPERADMIN_PASSWORD`, bcrypt cost < 12, malformed numeric/boolean env, and in production empty `CORS_ORIGINS` or `EMAIL_ENABLED != true` all abort boot. No default-secret fallbacks.

### Audit trail

`AuthEvent` rows (`userId` nullable, `actorUserId` = the admin behind an admin action, `type`, `ip`, `userAgent`, `createdAt`; no secrets, no emails): `REGISTERED`, `EMAIL_VERIFIED`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOCKED`, `LOGOUT`, `SESSION_REVOKED`, `PASSWORD_CHANGED`, `PASSWORD_RESET`, `APPROVED`, `REJECTED`, `BLOCKED`, `UNBLOCKED`. Written through `AuthEventService` (inside the unit of work when the event belongs to a business write). Purged after `AUTH_EVENT_RETENTION_DAYS` (90). Append new type values to the end of `AuthEventMapper`'s order (stable DB codes).

## Email & the transactional outbox

- **Port**: `EMAIL_SENDER_TOKEN` (`IEmailSender`: `sendEmailVerificationOtp`, `sendPasswordResetOtp`, `sendPasswordChangedNotice`, `sendPasswordResetCompletedNotice`). Adapters in `src/infrastructure/email/`: `SmtpEmailSender` (nodemailer, pooled, optional STARTTLS via `EMAIL_REQUIRE_TLS`, boot-time `verify()` probe) when `EMAIL_ENABLED=true`; `LogEmailSender` otherwise. **Production refuses to boot with `EMAIL_ENABLED != true`** or incomplete SMTP config (`email.config.ts`). Templates (English): `template/auth-email.templates.ts`.
- **Use-cases never call the mailer.** They insert an `Outbox` row (`OUTBOX_REPOSITORY_TOKEN`, `OutboxMessage.emailVerificationOtp(...)` / `.passwordResetOtp(...)` / `.passwordChangedNotice(...)` / `.passwordResetCompletedNotice(...)`) **inside the same unit-of-work as their business write**. `OutboxDispatcherCronJob` (5s poll, `FOR UPDATE SKIP LOCKED` claim, batch 50, worker pool of 8, exponential backoff 30s x 2^n, max 3 attempts then terminal FAILED, nightly purge of week-old PUBLISHED rows) fans each message out through the **`IOutboxEventHandler` registry** (`OUTBOX_EVENT_HANDLERS`). `Outbox.handledBy` records each handler's success so a retry re-runs only what failed.
- **Only `EmailSendHandler` is registered.** `DOMAIN_EVENT_TYPES` is empty. **To consume a new event**: add a value to `OutboxEventType`, a factory on `OutboxMessage`, a handler class in `application/outbox/handler/`, and register it in the `OUTBOX_EVENT_HANDLERS` factory in `infrastructure.module.ts`. An event type with no handler and not listed in `DOMAIN_EVENT_TYPES` fails (retries then FAILED).
- **Health**: `GET /api/v1/health` (`HealthUseCase`) reports `db`, `redis` (`ok`/`down`/`disabled`) and `outboxBacklog`. Redis is opt-in via `REDIS_ENABLED=true` (otherwise nothing connects and `REDIS_CLIENT` / `CACHE_SERVICE_TOKEN` resolve to `null`).

## Environment variables

All documented in `.env.development.default`. Required (boot fails without): `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_HMAC_SECRET`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, DB settings; in production also `CORS_ORIGINS` and `EMAIL_ENABLED=true` with `EMAIL_HOST/PORT/FROM` (+ `EMAIL_USER/PASS`). Tunables: `REQUIRE_APPROVAL`, `PASSWORD_SALT_ROUNDS`, `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_COOLDOWN_SECONDS`, `OTP_HOURLY_CAP`, `MAX_SESSIONS_PER_USER`, `SESSION_IDLE_TIMEOUT_SECONDS`, `SESSION_ABSOLUTE_LIFETIME_SECONDS`, `REFRESH_GRACE_SECONDS`, `JWT_ACCESS_EXPIRES_SECONDS`, `JWT_REFRESH_EXPIRES_SECONDS`, `ANTI_ENUMERATION_MIN_RESPONSE_MS`, `AUTH_EVENT_RETENTION_DAYS`, `RATE_LIMIT_*`, `TRUST_PROXY`, `BODY_LIMIT_BYTES`, `COOKIE_DOMAIN`, `COOKIE_SECURE`. Database and jobs: `DB_AUTO_MIGRATE` (default true), `ENGINES_ENABLED` (required in production), `WORKER_ENGINES`, `WORKER_POLL_INTERVAL_MS`, `JOB_LEASE_SECONDS`, `JOB_RETENTION_DAYS`, `WORKER_SHUTDOWN_GRACE_SECONDS`.

## Rules - MUST follow

Hard rules for any change. **After any change run the self-check: `npm run lint`, `npm run dep-check`, `npm run build`, `npm test`.**

### Protecting existing logic

- **Scope discipline:** only modify the files/functions the current feature requires. Never opportunistically refactor working code outside that scope.
- **Shared code:** before changing any shared function, service, repository, or type, list every caller and confirm the change is safe for all of them.
- **Do not "fix" the known baselines** (dep-check's 1 violation, the lint baseline in plumbing files - see below) unless explicitly asked.
- **Git is the safety net:** one feature per commit; keep unrelated changes out. Commit only when asked.

### dep-check baseline

`npm run dep-check` reports exactly **1 known violation**: `application.module.ts -> infrastructure.module.ts` (the acknowledged, commented smell - tokens resolve there). After a change it must show **no more than this 1**; any new violation is a regression - fix it by moving the code to the correct layer. Specs count too: application specs must not import infrastructure (use the in-memory fakes under `application/**/testing/`). The same config walls in `src/engines` (an engine may import only its own files and `sdk.ts`; nothing outside may import an engine's files) and lets infrastructure import only `engines/index.ts` and `engines/sdk.ts`.

### Lint baseline

`npm run lint` reports **44 errors / 0 warnings** (measured 2026-10-25, see `PROGRESS.md`), all in inherited plumbing (`typeorm.config`, `naming.strategy`, `try-catch.decorator`, `base.repository`, `update.service`, `exception-mapper`, filters/interceptors/validators under `presentation/common/`, `infrastructure.module`'s `dataSourceFactory`, `presentation.module`'s FASTIFY_INSTANCE factory). They are type-safety idioms, not regressions. **Newly written code must be lint-clean**; do not add to the baseline and do not mass-fix it unasked. `lint` runs with `--fix`, so it also reformats files it touches.

### Layering & responsibilities (one job per layer)

- **Respect the inward dependency rule.** Keep the `ApplicationModule -> InfrastructureModule` exception as-is; do not extend the smell.
- **Business logic lives in use-cases and domain only.**
- **Controllers (`*EndPoint`) stay thin** - receive the DTO, call one use-case, return its result. Cookie setting is the one transport concern a controller owns. No business logic, no DB access, no branching on domain state.
- **DTOs do validation + contracts only** (`class-validator`, in presentation). Use-cases take `I*Input` interfaces; DTOs `implements` them.
- **Repositories do persistence only.** No business decisions inside. DB access only through repositories.
- **Guards do authorization only.** Interceptors, decorators, filters, and modules carry no business logic.
- If a change would put business logic anywhere but a use-case or the domain, stop and move it.

### Patterns & consistency (align, don't invent)

- **Copy `example-item` (project-scoped) or `project` (global) before writing anything.** No new pattern where one exists.
- **Reuse first:** `findPaginate` + `PaginationQueryDto`, `updateAndReturn`, the unit-of-work, `IdDto`, `@QueryBoolean()`, `@NormalizedEmail()`, `@IsSecurePassword()`, `BaseOrmEntity`, the DI-token idiom.
- **Match naming exactly:** `*EndPoint` controller classes; kebab action routes (`create-project`, `get-projects`); `I*` interfaces; `*.aggregate.ts`, `*.mapper.ts`, `*.orm.entity.ts`, `*.use-case.ts`, `*.repository.impl.ts`.
- **No magic strings/numbers** - enums and constants.
- **Errors:** throw `GenericException(englishMessage, httpStatus, 'MODULE', 'CODE')` for business errors (auth ones come from `AuthErrors`); `GlobalExceptionFilter` + `ResponseInterceptor` shape the HTTP response. Never hand-format envelopes or swallow errors in a controller. Never put the existence of an account, or a secret, in an error message for an unauthenticated caller.
- **Composition over inheritance. Single responsibility per method.**

### Data safety

- **Atomicity:** any use-case with multiple writes that must all succeed or all fail runs inside the unit-of-work.
- **Idempotency:** mutating operations exposed to retries must not double-apply (pre-check on a natural key; atomic compare-and-swap for single-use / rotation).
- **No float arithmetic on money-like amounts** - integer/decimal columns, exact math.

### Restraint

- **No new libraries, frameworks, patterns, or dependencies without explicit request.**
- **No premature abstraction / over-engineering.**
- **Tests:** new use-cases and domain logic get a `*.spec.ts` next to the code (see `login.use-case.spec.ts` and `example-item.use-case.spec.ts` for the in-memory style; `application/auth/testing/in-memory.fakes.ts` wires the whole auth stack). Do not claim tests pass without running them.
- **Minimal comments:** none by default; only a non-obvious *why* or a genuine gotcha, one line. No commented-out code.
- **No stray `console.*`** - NestJS `Logger` / `JsonLogger` only.
- **No new README/docs files** - guidance lives in `CLAUDE.md`/`PROGRESS.md`.
- **Fewest-changes solution wins** when several valid implementations exist; explain any architectural concern before changing a boundary.

## How to add a project-scoped feature (checklist)

1. **Name it:** `<feature>` in kebab-case, used in all four layers. Copy `example-item`.
2. **Domain:** `aggregate/<feature>.aggregate.ts` (`create`/`restore`/`toPrimitives`, a `projectId` field), `repository/<feature>.repository.ts` (interface + `*_REPOSITORY_TOKEN`; every list/lookup takes `projectId`, names are looked up per project).
3. **Application:** `interface/<feature>.input.interface.ts` (`I*Input`; create input and list input carry `projectId`), `use-case/<feature>.use-case.ts` (inject by token incl. `PROJECT_REPOSITORY_TOKEN`; before any create/list call `assertProjectUsable(projectId)` -> 404 `PROJECT_001` / 409 `PROJECT_005`; `uow.execute` for multi-writes; `GenericException` with a new `MODULE_NNN` code). `projectId` is never updatable.
4. **Infrastructure:** `orm-entity/*.orm.entity.ts` (extend `BaseOrmEntity`; `projectId` uuid column + `@ManyToOne(() => ProjectOrmEntity, { nullable: false, onDelete: 'RESTRICT' })` + `@Index(['projectId'])`; unique fields are compound with `projectId` and a partial index `WHERE "deletedAt" IS NULL` when the table soft-deletes), `mapper/*.mapper.ts`, `repository/*.repository.impl.ts` (plain repository; filters by `projectId` explicitly).
5. **Presentation:** `dto/*.dto.ts` (create body and list query have `@IsUUID() projectId`; `implements` the input interfaces, `@ApiProperty`), `end-point/<feature>.controller.ts` with `@UseGuards(AuthGuard, RolesGuard)` and `@Roles(UserRole.SPARTAN, UserRole.SUPERADMIN)` (narrow to `SUPERADMIN` per handler for admin-only writes).
6. **Migration:** the next numbered SQL file in `src/infrastructure/database/migrations/` creates the table (synchronize is off; `database.int.spec.ts` fails if entity and SQL differ).
7. **Wire it:** ORM entity in `TypeOrmModule.forFeature` + `{ provide: TOKEN, useClass: Impl }` + export in `infrastructure.module.ts`; use-case in `application.module.ts` (providers and exports); controller in `presentation.module.ts`.
8. **Tests:** a spec for the use-case with an in-memory fake repository (reuse `InMemoryProjectRepository` from `application/project/testing/`).
9. **Verify:** `npm run lint`, `npm run dep-check`, `npm run build`, `npm test`; hit the endpoints against the running app; update `PROGRESS.md`.

## Cross-cutting conventions

- **Response envelope:** `ResponseInterceptor` wraps every success as `{ success, message, statusCode, data, error }` - controllers return bare payloads (the `message` is derived from the HTTP method, so a POST 200/202 still says "Created successfully"; clients should read `statusCode`/`data`).
- **Validation:** global `ValidationPipe` strips/rejects undeclared fields; errors surface in English as `ErrorType.VALIDATION`. `enableImplicitConversion` turns query-string `"false"` into `true` for boolean fields - use `@QueryBoolean()`.
- **Correlation IDs:** `CorrelationIdHook` (Fastify `onRequest`) opens an `AsyncLocalStorage` scope (`AsyncContextService`) with `correlationId` (client value accepted only if it matches `[A-Za-z0-9._-]{1,100}`) + `requestIp`, echoing `x-correlation-id`.
- **`@TryCatch()`** class decorator enriches thrown `BaseHttpException`s with class/method/line context for the global filter's structured logs.
- **Pagination:** list repos use `findPaginate(...)` -> `IPaginatedResponse<T>` (`data` + `meta: {itemsPerPage,totalItems,currentPage,totalPages}`), default sort `createdAt DESC`, max limit 100.
- **Scheduler:** `@nestjs/schedule` is wired; `AuthCleanupCronJob` (`src/infrastructure/scheduler/`) purges expired OTPs, expired/old-revoked sessions and aged auth events nightly; `OutboxDispatcherCronJob` delivers the outbox.

## Stack notes

- **Fastify** (not Express); `@fastify/{cookie,cors,helmet}` registered in `main.ts`. No multipart/file handling ships with the template - add `@fastify/multipart` and a storage port when first needed.
- **Config** by namespace via `registerAs` factories in `src/infrastructure/config/` (`AppConfig`, `DatabaseConfig`, `SwaggerConfig`, `AuthConfig` (incl. `settings` = `IAuthSettings`), `RateLimitConfig`, `EmailConfig`, `redis`), aggregated in `config/index.ts`; the env readers in `config/env.util.ts` fail fast.
- Postgres naming via `CustomNamingStrategy` - table name = class name (`User`, `Session`, `Project`, `ExampleItem`, in schema `platform`), explicit `PK_`/`FK_` names.
- `pg` is the driver. `strictNullChecks` on, `noImplicitAny` off, moduleResolution `nodenext`.

## Gotchas

- `synchronize` is off for good: a new or changed entity without a migration compiles and passes the unit tests but has no table at runtime. Only `npm run test` with `TEST_DATABASE_URL` set catches it (`database.int.spec.ts`), so run it before you push.
- A UPDATE/DELETE through `dataSource.manager.query` returns `[rows, affectedCount]` (TypeORM), any other statement returns the rows; `PgJobQueue.exec` and `rowsOf` normalise that.
- Unique indexes on `Project(name)`, `Project(code)` and `ExampleItem(projectId, name)` are partial (`WHERE "deletedAt" IS NULL`) so a soft-deleted name can be reused; keep that shape for any soft-deleting table. Soft-deleting a project does not touch its items (they become unreachable through the list/create paths, which require a live active project).
- Rate-limit counters and the 5 s user-state cache are per process; behind several instances the effective limits multiply (move the throttler storage to Redis if that matters).
- The OTP of an email that is waiting in the outbox is readable by anyone with database access until delivery (the email needs it); it is redacted right after delivery, and expires in 10 minutes anyway.
