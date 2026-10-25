# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## What this is

`template-front` is a lean, reusable **frontend template**: a single-page React app (authenticated app only, no marketing site) that pairs with `template-back`. It ships a complete, small auth model and one reference feature:

- **Auth**: email + password, **email OTP verification** (6-digit code), forgot/reset password by OTP, change password, multi-session with a manageable sessions list. No OAuth/social, no TOTP/2FA apps, no passkeys, no magic links.
- **Two fixed roles**: `SUPERADMIN` and `SPARTAN`. No companies, no role editor, no permission keys.
- **Flat Projects** (SUPERADMIN manages, everyone reads) and **project-scoped `example-items`** as the copy-me reference for project-scoped features.
- **Users** admin (SUPERADMIN): approve / reject / block / unblock, per-user sessions, auth activity log.

Rename the product strings ("App", the `BrandMark` SVG, the login tagline) when you fork it.

## Commands

```bash
npm run dev         # Vite dev server on http://localhost:3000
npm run build       # tsc -b && vite build -> dist/
npm run preview     # serve the production build
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint .
```

There is **no test suite**. Verification is typecheck + lint + build + driving the app in a browser. Do not claim tests pass; there are none.

`.env.development` (gitignored) holds `VITE_API_BASE_URL=http://localhost:5000/api/v1`. Copy `.env.example` to create it. The backend's `CORS_ORIGINS` must allow `http://localhost:3000` with credentials.

## Stack

- **Vite 6 + React 19 + TypeScript (strict)**. No CRA, no Next.
- **React Router 7** (`createBrowserRouter`) with **route-level `React.lazy`**: every page is its own chunk.
- **TanStack Query** for all server state, **Zustand** for the little client state (auth, theme, toasts).
- **Tailwind v4** (`@tailwindcss/vite`) + a hand-rolled **shadcn-style headless component kit** in `src/components/ui/`. No Antd, no MUI.
- **framer-motion** (via `LazyMotion`, `m.*`) for the motion kit in `src/components/motion` and `src/lib/motion`.
- **axios**: one dedicated instance, not the global default.
- No date lib, chart lib, or rich-text editor. Add heavy libraries **lazily, per feature**, with a `manualChunks` entry in `vite.config.ts`.

## Routes

| Path | Access | Page |
|---|---|---|
| `/login`, `/register` | public (signed-in users are redirected away) | `features/auth` |
| `/verify-email` | public | 6-digit OTP entry; email from router state or `?email=` (never the password) |
| `/forgot-password`, `/reset-password` | public | request code, then email + code + new password |
| `/` | any signed-in user | Dashboard placeholder |
| `/account` | any signed-in user | Change password + Active sessions (`features/account`) |
| `/settings` | any signed-in user | Theme only |
| `/projects` | any signed-in user | List (SUPERADMIN also: create/edit/delete) |
| `/projects/:id` -> `/projects/:id/items` | any signed-in user | Project work area (tabs + nested routes) |
| `/users` | `SUPERADMIN` | Moderation, per-user sessions, auth activity |
| `/403`, `*` | public | Forbidden / Not found |

## Architecture: feature-sliced

```
src/
  app/            App root, providers, router, layouts (PanelLayout + sidebar), generic pages (403/404)
  components/
    ui/           Headless primitives: Button, Input/Field, OtpInput, Select, DropdownSelect, Table, Badge,
                  Card, Modal, ConfirmDialog, Pagination, Switch, PasswordInput
    layout/       PageHeader
    feedback/     FullscreenLoader, States (Empty/Error/Loading), toast
    motion/       Animated* wrappers
  features/<name>/  One folder per backend module; see the slice contract below
  lib/
    api/          client (axios+envelope), api-error, query-client, wire types
    hooks/        useDebounce, ...
    utils/        cn(), format (formatDate/formatRelativeTime/orDash)
    motion/       tokens, variants, MotionProvider
  styles/         Tailwind entry + design tokens (CSS vars, brand-* colors)
```

### The feature-slice contract (copy this shape for every new module)

`projects` (entity CRUD with role-gated writes) and `example-items` (**project-scoped**) are the reference implementations. Every feature folder holds:

| File | Holds |
|---|---|
| `<name>.types.ts` | Entity type, input types (Create/Update), query type, enum unions + label maps. Enums are **string unions** (`as const` arrays + derived type), not TS enums. |
| `<name>.api.ts` | An `xxxApi` object of thin functions calling `api.*` with **relative** paths (`/project/get-projects`). No React here. |
| `<name>.hooks.ts` | `useXxx` query hooks + `useCreateXxx`/`useUpdateXxx`/... mutation hooks. Mutations invalidate the feature's query key, toast on success, and share an `onError` that toasts `ApiError.message`. |
| `<Name>Page.tsx` | The list page. **Default export** (it is lazy-imported). Search + filters + `Table` + `Pagination`. |
| `<Name>FormModal.tsx` | Create/edit modal (where writes exist). Seeded from props on mount; the page re-keys it on each open. |
| `<Name>StatusBadge.tsx` | Maps a status enum to a `Badge` tone (where the entity has a status enum). |

Features in the repo: `auth` (public auth flow, store, guards, bootstrap), `account` (self-service password + sessions), `users` (SUPERADMIN), `projects`, `example-items`, `dashboard`, `settings` (theme store + page).

## The API layer: read before touching data

`src/lib/api/client.ts` is the spine. Rules that must not break:

- **`api.get/post/put/patch/delete<T>(url, config?)`** return the **unwrapped** `data`. The backend wraps everything in `{ success, message, statusCode, data, error }`; the client strips that. Callers get `T` directly.
- **Errors throw `ApiError`** (not a sentinel), so `useQuery.isError` / `try/catch` / retry all work. `ApiError` carries `statusCode`, `errorCode`, `message`, `isUnauthorized`.
- **`withCredentials: true`**: auth tokens are **HttpOnly cookies** set by the backend; the client never reads or stores a token. Never add `Authorization` headers or touch `document.cookie`.
- **401 refresh is single-flight**: one `POST /auth/refresh` at a time; concurrent 401s queue and replay. The `AUTH_BYPASS` list (login, register, verify-email, resend-verification, forgot/reset-password, refresh, logout) skips the loop, and so does any 401 whose `errorCode` is `AUTH_INVALID_CREDENTIALS` (wrong current password on change-password is not an expired session). A failed refresh calls `onAuthLost`.
- **Pagination shape is fixed**: lists return `Paginated<T> = { data: T[], meta: { itemsPerPage, totalItems, currentPage, totalPages } }`. Query params are `page`, `limit`, `order` (+ per-module filters).
- `queryClient` is a **module singleton** (staleTime 60s, no refetch-on-focus, no retry on 4xx). Don't `new QueryClient()` in a component.
- Session lists may arrive as a plain array or `{ data: [] }`; `normalizeSessions` (in `account.api.ts`) accepts both.

## Auth and roles (must mirror the backend exactly)

- **Registration**: `POST /auth/register` (generic 202) -> navigate to `/verify-email` with only the **email** in router state -> 6-digit OTP (`POST /auth/verify-email {email, code}` -> `{status}`; `PENDING_APPROVAL` means a SUPERADMIN still has to approve). Resend is `POST /auth/resend-verification` with a 60 s cooldown.
- **Login**: `POST /auth/login` -> `{ user }`. Failures carry `errorCode`: `AUTH_INVALID_CREDENTIALS`, `AUTH_EMAIL_NOT_VERIFIED` (routes to the OTP screen), `AUTH_PENDING_APPROVAL`, `AUTH_BLOCKED`, `AUTH_LOCKED`.
- **OTP errors** (`AUTH_INVALID_OTP`, `AUTH_OTP_EXPIRED`, `AUTH_OTP_ATTEMPTS_EXCEEDED`) and rate limits (HTTP 429 / `AUTH_RATE_LIMITED`) are mapped to friendly messages in `auth.errors.ts`.
- **`useAuthStore`** (Zustand) holds `status`, `user {id,email,role,status}` and a `sessionLost` flag. It never holds tokens.
- **`useAuthBootstrap`** runs once at boot: `GET /auth/me` -> hydrate or mark unauthenticated. When a live session is lost later (revoked elsewhere, refresh failed) `onAuthLost` flips the store with `sessionLost: true` and the login page shows "You were signed out".
- **Roles are two fixed strings**: `UserRole = 'SUPERADMIN' | 'SPARTAN'`. Check them in exactly three ways:
  1. Routes: `<RequireRole roles={['SUPERADMIN']}>` in `router.tsx` (redirects to `/403`).
  2. Nav: `NAV` items in `PanelLayout` carry `roles?: UserRole[]`.
  3. Buttons: `const { hasRole } = useAuth(); hasRole(['SUPERADMIN'])` (pure helper `hasRole(role, roles)` lives in `auth.roles.ts`).
  The UI check is UX only; the server is the security boundary.
- `RequireAuth` redirects to `/login` (preserving the attempted path). `RedirectIfAuthenticated` keeps signed-in users off login/register. Redirect targets go through `safeRedirect` (in-app absolute paths only).
- Passwords: policy hints (8+ chars, upper, lower, digit, special, max **72 bytes**) live in `password-policy.ts` and mirror the backend; the server still enforces them.
- **Security hygiene**: never store or log tokens, passwords or OTP codes (no localStorage, no `console`); the password is cleared from state after submit and never put in router state or URLs; every submit button is disabled while pending (`Button loading`) and handlers guard on `isPending`; autocomplete attributes are `current-password` (login), `new-password` (register/reset/change), `one-time-code` (OTP). Never render server HTML unsanitized (React text only, no `dangerouslySetInnerHTML`).

## Conventions and gotchas

- **TypeScript is strict; `any` is an ESLint error.** Use `unknown` + narrowing. `import type` is required for type-only imports (`verbatimModuleSyntax`).
- **No `console.log`** (ESLint warns; `console.warn`/`error` allowed).
- **Drop empty-string optionals before sending** a form (see the submit step in `ProjectFormModal`).
- **Enums serialize as strings**; dates as ISO strings. Type them as string unions.
- `cn(...)` (clsx + tailwind-merge) is the only way to compose class names.
- **Scrollbars are invisible app-wide**. Keep using `overflow-auto`; never add visible scrollbar styling.
- **List/table filters use `DropdownSelect`**, **never the native `Select`**. Native `Select` is correct **inside forms**.
- `toast.success/error/info` is imperative and works outside React.
- The `@/` alias maps to `src/` (in `tsconfig.app.json` `paths` and `vite.config.ts`).
- The one standing ESLint warning is in `components/feedback/toast.tsx` (component + helper in one file; deliberate).
- Modals keep their children mounted for the exit animation and seed form state once on mount. When a modal edits different records, **re-key it per open** (see `ProjectsPage`).
- Destructive or access-changing actions go through `ConfirmDialog`.
- Entity ids are UUID strings (UUIDv7, generated by Postgres) - type them `string`, never `number`. `useProjectId` returns the route id only when it looks like a UUID. Route params and query params carry them as they are; do not `Number()` an id.

## How to add a project-scoped feature

1. **Backend first**: add the module with a required `projectId` (list query + create body) under `/<kebab>/...`.
2. Copy `src/features/example-items/` to `src/features/<names>/` and rename: types (keep `projectId` in `Create...Input` and in the list `Get...Query`), api paths, hooks, `<Names>Page.tsx` (default export), `<Name>FormModal.tsx`.
3. In the page, read the project with `useProjectId()` (from `features/projects`), put it in the memoized query object (so each project has its own cache key) and pass it to the form modal for the create body. Never ask the user for a project id.
4. Add a **child route** under `projects/:id` in `src/app/router.tsx` (lazy page) and a tab entry in `TABS` in `ProjectDetailPage.tsx`.
5. Role-restrict buttons with `useAuth().hasRole([...])` and, for whole pages, wrap the child element in `<RequireRole roles={[...]}>`.
6. `npm run typecheck && npm run lint && npm run build`, then click through it against the real backend as both roles.

(For a non-project-scoped module: same copy, but add a top-level lazy route, a `NAV` entry in `PanelLayout.tsx`, and optionally `roles`.)

## Working rules: layering, consistency, restraint

### Layering (one job per unit)

- **Business/data logic lives in the api layer and hooks, never in components.**
  - `<name>.api.ts`: network I/O only, through the shared `api` client. No React, no toasts.
  - `<name>.types.ts`: request/response/payload types.
  - `<name>.hooks.ts`: query/mutation hooks; consistent array query keys; invalidate related queries on mutation success.
- **Components stay thin**: render + wire user interaction + call hooks. Never fetch from a component.
- **Auth/access control lives in one place**: `features/auth` (`guards.tsx`, `auth.roles.ts`, `useAuthStore`, the 401-refresh interceptor in `client.ts`). **Flag before changing any auth behavior.**

### Consistency (align, don't invent)

- Follow existing patterns and put new code where its peers live. **Reuse first**: `components/ui`, `lib/hooks`, the `api` client, `lib/utils`, existing stores. No raw `fetch`/`axios`.
- **One data-fetching approach (TanStack Query), one client-state approach (Zustand).** Don't duplicate server data into a store.
- No magic strings: use constants and string-union types.
- **Secrets never reach the bundle**: anything prefixed `VITE_` is inlined into the public build.

### Performance rules

- Every page is a `React.lazy` route chunk; keep the initial bundle to the shell + login.
- Keep heavy deps out of the shared graph: lazy-load the component that needs them and add a `manualChunks` entry.
- Debounce search inputs (`useDebounce`) and memoize query objects so query keys stay stable.
- Use `placeholderData: keepPreviousData` on paginated lists.
- No new libraries or dependencies without explicit request.

### Restraint

- No premature abstraction. Choose the fewest-changes solution that stays correct and readable.
- Do not write tests unless explicitly requested.
- Explain any architectural concern **before** a change that affects auth, the api-client contract, or shared `components/ui` primitives.

## Verifying changes

1. `npm run typecheck`, `npm run lint`, `npm run build`.
2. Drive it in a browser: start `template-back` (port 5000) and this app (port 3000); register, verify with the emailed code, approve as SUPERADMIN, sign in as both roles.

See `PROGRESS.md` for the running log.
