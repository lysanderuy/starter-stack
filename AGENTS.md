<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Architecture rules (binding)

Layered, one-direction flow. Never skip or short-circuit a layer:

```
page/client component → TanStack Query hook (src/hooks) → api wrapper (src/lib/api/client.ts)
  → route handler (src/app/api/**) → service (src/services) → db (src/db, Drizzle)
```

- Client components NEVER import from `src/services` or `src/db`. They reach the backend only through `src/hooks` → the `api` wrapper. Both layers start their entry files with `import "server-only"` so an accidental client import fails the build instead of leaking server code/secrets to the browser — keep this line at the top of every `*.service.ts` and `src/db/index.ts`.
- Route handlers stay thin: authenticate (`createClient()` from `src/lib/supabase/server` + `getUser()`), validate with Zod, delegate to a service, respond with `apiSuccess`/`apiError`/`handleApiError` from `src/lib/api/response`. All routes return the `ApiResponse<T>` envelope (`src/types/api.ts`).
- Services own ALL business logic and DB access. They never touch `Request`/`Response`/cookies; they take plain inputs (e.g. `userId`) and must scope every query to the authenticated user.
- Exception: auth itself calls the Supabase SDK directly from pages (it manages its own cookies). App data never does this.

## Adding a resource — follow this order

1. Schema: `src/db/schema/<things>.ts`, export from `schema/index.ts`, `npm run db:generate` + `db:migrate`
2. Validator: `src/validators/<thing>.validator.ts` (Zod is the source of truth; infer TS types from schemas)
3. Service: `src/services/<thing>.service.ts`
4. Route: `src/app/api/<things>/route.ts`
5. Hook: `src/hooks/use-<thing>.ts` (`useQuery`/`useMutation` wrapping the `api` client)
6. UI: `src/app/` + `src/components/` consuming the hook
7. Docs: register the endpoint in `src/lib/api/openapi.ts` (path entry + `.meta()` on new/changed validator fields) — not auto-derived from the route file

## Hard rules

- **Every new table's migration must include `ALTER TABLE "<name>" ENABLE ROW LEVEL SECURITY;`** (no policies needed). `npm run db:migrate` runs a guardrail that fails otherwise. Reason: Drizzle bypasses RLS, but Supabase's PostgREST (`/rest/v1`) exposes any public table without RLS to the anon key.
- This is Next 16: the request middleware file is `src/proxy.ts` (exports `proxy`), NOT `middleware.ts`. `cookies()` and route params are async — await them.
- Migrations only via drizzle-kit (`db:generate`/`db:migrate`); never hand-edit `src/db/migrations` except `--custom` migrations. drizzle-kit uses `DIRECT_URL` (session pooler, 5432); the app uses `DATABASE_URL` (transaction pooler, 6543, `prepare: false`).
- Server env vars go through `src/lib/env.ts` (Zod-validated, server-only import). Client code uses `process.env.NEXT_PUBLIC_*` directly.
- Server state lives in TanStack Query; client-only UI state in Zustand (`src/stores/*.store.ts`). Never mirror API data into a store.
- New protected routes: add the prefix to `protectedPrefixes` in `src/lib/supabase/proxy.ts` AND check `getUser()` in the page/route itself.
- `/api/openapi.json` is the one deliberate exception to "every route returns `ApiResponse<T>`" — it serves the raw spec for external tooling (Scalar, codegen). `/api/docs` (Scalar UI) and `/api/openapi.json` are public/unauthenticated by design; gate them if that's ever a concern. The spec (`src/lib/api/openapi.ts`) is hand-maintained, not derived from route files — keep it in sync per the "Adding a resource" step above.

## Naming

`*.service.ts`, `*.validator.ts`, `*.store.ts`, `use-*.ts` (one hook per file), `*.test.ts` (colocated next to the file it tests). `src/components/ui` = generic primitives; `src/components/shared` = app-specific composites.

## Testing

Vitest, unit-only, node environment (no jsdom yet). Only pure logic is
covered — validators (`src/validators`) and framework-free `src/lib`
helpers. Services and routes touch Drizzle/Supabase and are intentionally
untested for now: this project has no dedicated test database, and mocking
the Drizzle client would give false confidence rather than real coverage.
Don't add jsdom, Testing Library, or DB mocking to "fix" this without
checking with the user first — it's a deliberate scope boundary, not a gap.

## Verify before declaring done

`npx tsc --noEmit && npm run lint && npm test` after every change; `npm run db:verify` after schema changes. Do not run `npm run build` without asking.

## Commits

Conventional Commits, split by concern (`feat:`, `fix:`, `docs:`, `chore:`, ...). Subject line only — no body, no Co-Authored-By trailer.
