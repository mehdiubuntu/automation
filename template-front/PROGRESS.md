# PROGRESS

Short running log. Newest first.

## UUID ids

- The backend now generates UUIDv7 ids for every table. All ids in `features/*` types, api functions and hooks are `string`; `useProjectId` validates the route id as a UUID; the `Number.isInteger(id)` guards became `Boolean(id)`.
- Verified: `npm run typecheck`, `npm run lint` (0 errors, 1 known warning), `npm run build`. Still not driven in a browser against the live backend.
- Not done (not asked for): a jobs screen for the new `/job/*` endpoints.

## Lean auth rework

- Replaced the multi-tenant/PBAC model with: email + password, email OTP verification, two fixed roles (`SUPERADMIN`, `SPARTAN`), flat Projects, project-scoped example-items.
- Removed: companies, roles, staff, security (2FA/recovery/sessions UI), outbox, company switching, permission keys (`RequirePermission`, permission lists in the store), change-password-on-first-login gate, unused `Combobox`/`MultiCombobox`/`Avatar`/`TruncatedText`.
- Added: `features/auth` (Login, Register, VerifyEmail OTP, ForgotPassword, ResetPassword, `OtpInput`, role guard `RequireRole` + `hasRole`, `sessionLost` notice), `features/account` (change password, active sessions), `features/users` (status tabs, search, approve/reject/block/unblock with confirm, per-user sessions modal, auth-activity modal), `features/projects` (list, form modal, detail page hosting nested routes), `components/ui/ConfirmDialog`.
- `example-items` is now project-scoped: `/projects/:id/items`, `projectId` in the list query and create body.
- API client: bypass list updated for the new public auth endpoints; 401 with `AUTH_INVALID_CREDENTIALS` no longer triggers refresh/sign-out.
- Verified: `npm install`, `npm run typecheck`, `npm run lint` (0 errors, 1 known warning in `toast.tsx`), `npm run build`.
- NOT verified: anything against a live `template-back` (built to the written API contract only), and no browser walkthrough was done.

## Open items

- Confirm against the final backend endpoint list (paths, `errorCode`s, response shapes, numeric vs string ids).
- Confirm whether `SPARTAN` may write example-items (the UI currently allows it) and what the backend does with a project's items on delete.
- Rename branding (`App`, `BrandMark`, login tagline, favicon) for the real product.
- Consider a rate-limit `Retry-After` display if the backend sends one.

## Initial template

- Derived from `new-crm-front` by removing CRM features and their heavy dependencies; added `features/example-items` as the reference slice.
