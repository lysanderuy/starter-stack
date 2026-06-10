# starter-stack

Reusable full-stack boilerplate.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (`@supabase/ssr`, cookie-based sessions) |
| ORM | Drizzle ORM + drizzle-kit migrations |
| Validation | Zod v4 |
| Server state | TanStack Query v5 (API data: caching, mutations) |
| Client state | Zustand (UI-only state: modals, sidebar, filters) |

## Architecture

Strict one-direction flow. Each layer only talks to the layer below it.

```
page / client component
        │  TanStack Query hooks (src/hooks) → api wrapper (src/lib/api/client.ts)
        ▼
route handler (src/app/api/**)     ← auth check + Zod validation only
        │
        ▼
service (src/services/**)          ← all business logic
        │
        ▼
db (src/db, Drizzle)  /  Supabase
```

Rules:

- **Frontend never imports services or `db`.** It calls `/api/**` through the `api` wrapper only.
- **Route handlers stay thin**: authenticate (Supabase), validate input (Zod), delegate to a service, wrap the result with `apiSuccess` / `apiError`.
- **Services own business logic and DB access.** They never touch `Request` / `Response` / cookies.
- All API routes return the `ApiResponse<T>` envelope (`src/types/api.ts`).
- **Server state vs client state**: API data lives in TanStack Query (via `src/hooks`), UI-only state in Zustand stores (`src/stores`). Never mirror API data into a store.

## Project structure

```
src/
├── app/                  # Routes, layouts — frontend only
│   ├── (auth)/           # Login, signup, forgot/reset password (route group)
│   ├── dashboard/        # Example protected page
│   ├── error.tsx         # Error boundary (wire Sentry etc. here)
│   ├── global-error.tsx  # Root-layout error fallback (self-contained)
│   ├── not-found.tsx     # 404
│   └── api/              # Route handlers only — no UI under api/
│       ├── auth/
│       │   ├── callback/ # Code exchange (email confirm, OAuth)
│       │   └── logout/   # POST sign-out
│       └── profile/      # example: GET/PATCH /api/profile
├── components/
│   ├── ui/               # Generic primitives (buttons, inputs, ...)
│   └── shared/           # Composed, app-specific components
├── hooks/                # React hooks (use-*.ts), incl. TanStack Query hooks
├── stores/               # Zustand stores (*.store.ts) — client-only UI state
├── lib/
│   ├── api/
│   │   ├── client.ts     # Typed fetch wrapper (frontend → /api)
│   │   └── response.ts   # apiSuccess / apiError / handleApiError
│   ├── query/
│   │   └── provider.tsx  # QueryClient provider (wired in app/layout.tsx)
│   ├── supabase/
│   │   ├── client.ts     # Browser client (client components)
│   │   ├── server.ts     # Server client (RSC, route handlers, actions)
│   │   └── proxy.ts      # Session refresh helper
│   └── env.ts            # Zod-validated env vars (server only)
├── services/             # Business logic (*.service.ts)
├── validators/           # Zod schemas (*.validator.ts) — input source of truth
├── types/                # Shared TS types (api.ts envelope, ...)
├── db/
│   ├── index.ts          # Drizzle client (postgres.js, pooler-safe)
│   ├── schema/           # Table definitions (one file per table)
│   └── migrations/       # drizzle-kit output — only edit --custom migrations
└── proxy.ts              # Next.js 16 proxy, ex-middleware (auth session refresh)
```

Outside `src/`: `scripts/` (RLS guardrail + auth debug, see Scripts below),
`drizzle.config.ts` (drizzle-kit config — schema path, migration dir, `DIRECT_URL`).

The `profiles` table + validator + service + route are a working reference
implementation of the layering — replace per project.

## Auth

Working end-to-end: signup → email confirm (`/api/auth/callback`) → login →
protected `/dashboard` → logout. Password recovery: `/forgot-password` emails
a link that lands on `/reset-password` (via the callback's `next` param) with
a recovery session. Email verification is enforced by Supabase itself
(unconfirmed users can't sign in); login and signup offer a resend button,
and login surfaces callback errors (e.g. expired links) from `?error=`.
Unauthenticated hits on protected prefixes
are redirected by `src/proxy.ts` (extend `protectedPrefixes` there); pages
still check `getUser()` themselves — defense in depth.

Auth is the one exception to the API layering: pages call Supabase Auth
directly via the SDK (it manages its own cookies). App data still always
goes through `/api`.

A Postgres trigger (`0001_auth-trigger-and-rls.sql`) auto-creates a
`profiles` row on signup.

### Starting with an empty DB (removing the profiles example)

Auth does not depend on `profiles` — identity lives in `auth.users` +
cookies. To start a project with a clean schema, delete the example slice:

```
src/db/schema/profiles.ts            # + remove its export from schema/index.ts
src/db/migrations/0000_*.sql, 0001_*.sql, meta/   # keep the migrations dir
src/validators/profile.validator.ts
src/services/profile.service.ts
src/app/api/profile/
src/hooks/use-profile.ts
```

Then define your own tables and run `db:generate` + `db:migrate` as usual.
Only delete migrations that were never applied (fresh Supabase project);
if they were already applied, drop the objects first (`DROP TABLE profiles;
DROP FUNCTION public.handle_new_user CASCADE;`) or reset the database.

If you later want a user companion table again, reuse the pattern from
`0001_auth-trigger-and-rls.sql`: FK to `auth.users(id) ON DELETE CASCADE`,
`ENABLE ROW LEVEL SECURITY`, and an `AFTER INSERT ON auth.users` trigger.

**Security model:** Drizzle connects as `postgres` and bypasses RLS, so
authorization lives in route handlers (`getUser()` + user-scoped queries).
Every table must still `ENABLE ROW LEVEL SECURITY` (with no policies) to
lock Supabase's auto-generated REST API (`/rest/v1`) away from the anon key.
This is enforced: `db:migrate` runs the RLS guardrail (`scripts/verify-db.mjs`)
after applying migrations and fails if any public table has RLS disabled.

## Setup (new project from this template)

1. `npm install`
2. Create a Supabase project, then copy env: `cp .env.example .env.local` (or `.env` — both load) and fill in values.
   - `DATABASE_URL`: **transaction pooler** URL (port 6543) for the app — the Drizzle client is configured with `prepare: false` for it.
   - `DIRECT_URL`: **session pooler** URL (port 5432) — used only by drizzle-kit; migrations fail through the transaction pooler, and the "direct connection" URL is IPv6-only.
3. Configure Supabase Auth (Dashboard → Authentication):
   - URL Configuration → Redirect URLs: add `http://localhost:3000/api/auth/callback` (+ production URL later). Confirmation and recovery emails bounce without this.
   - Production: configure custom SMTP (Project Settings → Auth). The built-in
     sender is dev-only — rate-limited (~2/hour), slow, and spam-prone.
4. Apply the bundled example schema — or remove it first (see
   "Starting with an empty DB" above):
   ```bash
   npm run db:migrate    # applies migrations + runs RLS guardrail
   ```
5. `npm run dev` — sign up at `/signup`, confirm via email, land on `/dashboard`.

For your own tables: define in `src/db/schema/`, then
`npm run db:generate -- --name=create-things` (name it — otherwise drizzle-kit
invents one like `0000_blushing_rockslide`) and `npm run db:migrate`.

## Scripts

| Script | Purpose |
|---|---|
| `dev` / `build` / `start` | Next.js |
| `lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `db:generate` | Generate migration from schema diff |
| `db:migrate` | Run pending migrations, then RLS guardrail |
| `db:verify` | RLS guardrail — fails if any public table has RLS disabled |
| `db:auth-users` | Debug: list recent signups + email confirmation status |
| `db:push` | Push schema directly (prototyping only) |
| `db:studio` | Drizzle Studio data browser |

## Adding a new resource (the pattern)

1. **Schema** — `src/db/schema/things.ts`, export from `schema/index.ts`, run `db:generate` + `db:migrate`.
2. **Validator** — `src/validators/thing.validator.ts` (Zod schemas + inferred input types).
3. **Service** — `src/services/thing.service.ts` (business logic, Drizzle queries).
4. **Route** — `src/app/api/things/route.ts` (auth → validate → service → respond).
5. **Hook** — `src/hooks/use-thing.ts` (`useQuery`/`useMutation` wrapping the `api` client).
6. **Frontend** — components consume the hook, build UI in `app/` + `components/`. UI-only state goes in `src/stores` if it crosses component trees.
