# template-front

Reusable frontend template for a small authenticated app with email+password+OTP auth, two fixed roles and projects. Pairs with `template-back`. **App-only** (no public site), **performance-first**.

## Stack

- **Vite 6 + React 19 + TypeScript** (strict)
- **React Router 7** (data router, route-level code splitting)
- **TanStack Query** for server state, **Zustand** for the small client state (auth, theme)
- **Tailwind v4** + a shadcn-style headless component kit (`src/components/ui`)
- **axios** with a dedicated instance, envelope unwrapping and a 401-refresh single-flight

## Run

```bash
npm install
cp .env.example .env.development   # points at http://localhost:5000/api/v1
npm run dev                        # http://localhost:3000
npm run build                      # tsc -b && vite build
npm run typecheck                  # tsc -b --noEmit
npm run lint
```

## Routes

| Path | Who |
|---|---|
| `/login`, `/register` | public |
| `/verify-email` (6-digit code), `/forgot-password`, `/reset-password` | public |
| `/` Dashboard, `/account` (password + sessions), `/settings` (theme) | signed-in |
| `/projects`, `/projects/:id/items` | signed-in (SUPERADMIN also creates/edits/deletes projects) |
| `/users` (approve/reject/block/unblock, sessions, activity) | `SUPERADMIN` |
| `/403`, `*` | public |

## Structure

```
src/
  app/            App root, providers, router, layouts, generic pages (403/404)
  components/     ui/ (primitives), layout/, feedback/, motion/
  features/
    auth/           login, register, OTP verify, forgot/reset, store, guards, bootstrap
    account/        change password, active sessions
    users/          SUPERADMIN user moderation, sessions, auth activity
    projects/       project list/form/detail (hosts project-scoped tabs)
    example-items/  Reference project-scoped slice: copy this for new modules
    dashboard/      Placeholder landing page
    settings/       Theme store + page
  lib/            api client, hooks, utils, motion
  styles/         Tailwind entry + design tokens
```

## Backend contract

- Base URL: `.../api/v1`; response envelope `{ success, message, statusCode, data, error }`. The client unwraps to `data` and **throws `ApiError`** on failure.
- Pagination: `{ data, meta: { itemsPerPage, totalItems, currentPage, totalPages } }`; query `page`, `limit`, `order`.
- Auth: JWT in **HttpOnly cookies**; the client only sends `withCredentials` and never touches a token.
- Roles: `SUPERADMIN` and `SPARTAN`, checked with `RequireRole` / `hasRole`.
- Endpoints used: see "Auth and roles" and the `*.api.ts` files in `CLAUDE.md` / `src/features`.

## Adding a feature

See "How to add a project-scoped feature" in `CLAUDE.md`. In short: copy `src/features/example-items/`, read the project with `useProjectId()`, add a child route under `projects/:id` and a tab in `ProjectDetailPage`.
