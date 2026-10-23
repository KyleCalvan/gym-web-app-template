# VinAthletics — Backend & Database: How It Works, and What It Takes To Run Always Online

> **Status:** living document, written 2026-10-24 against commit `f1db950`.
> Everything here was read out of the code, not assumed. Where something is
> missing or unfinished it says so plainly.

---

## 1. The one-paragraph mental model

There is **one application**, not two. The Next.js app at the repository root owns
both the UI *and* the entire backend: every `/api/*` route handler, the auth
callback, and the database access live inside `app/` and `src/`. Data lives in a
single **PostgreSQL** database, reached through **Prisma 5.22** using the
**driver-adapter** path (`pg` + `@prisma/adapter-pg`) rather than Prisma's own
query engine at runtime. Identity comes from **NextAuth v4 with Google**, using
**database sessions** — the session, the account, the roles, and the profile all
live in Postgres, so the database is not a side detail, it *is* the state of the
whole system. The `backend/` folder is a separate, mostly-empty Express scaffold
that serves only a health check and does **not** own authentication or any gym
workflow.

If you remember one sentence: **swap `DATABASE_URL` for a managed Postgres, run
seven migrations, and this app is portable to any host.** Nothing in the data
layer assumes localhost.

---

## 2. Stack at a glance

| Layer | What is used | How it is used here |
|---|---|---|
| Runtime | **Node.js 24** | README's stated target; verified on v24.18.0 |
| Framework | **Next.js 16** (App Router, Turbopack) | One process serves the SPA *and* all `/api/*` routes |
| UI | **React** + TypeScript | `strict: true`; `next typegen` runs before typecheck |
| Auth | **NextAuth v4** (`next-auth@^4.24.15`) | Google provider, PKCE + state, **database** session strategy |
| ORM | **Prisma 5.22.0** (pinned at root *and* backend) | Schema + migrations + generated client |
| DB driver | **`pg` + `@prisma/adapter-pg`** | `previewFeatures = ["driverAdapters"]` — a real `pg.Pool` at runtime |
| Database | **PostgreSQL** (any 14+) | Single `public` schema, `DATABASE_URL` only |
| Validation | Hand-written guards in each route | No Zod; explicit `typeof` checks + typed Prisma inputs |
| Audit | `AuditEvent` table + `writeAudit()` | Every authorization decision and domain mutation is recorded |
| Tests | `node:test` | Unit (43) + integration (26) against a disposable PostgreSQL |
| Scaffold | **Express** (`backend/src/`) | `/api/health` only; **not** part of the real API surface |

---

## 3. Request lifecycle (what happens on one API call)

```
Browser (React, src/lib/api-client.ts)
   │  fetch('/api/orders', { method:'POST', credentials:'include' })
   ▼
Next.js route handler            app/api/<resource>/route.ts
   │  export async function POST(request: NextRequest)
   ▼
withBusinessAuthorization()      src/auth/http.ts   ← the single gate
   │
   ├─ requestId = randomUUID()
   ├─ prisma.$transaction(async (tx) => {        ← everything inside one tx
   │     ├─ read session cookie  → lookupSession(tx, token)
   │     │     └─ none?              → 401 UNAUTHENTICATED
   │     ├─ hasSameOrigin(request)   → 403 ORIGIN_REJECTED
   │     ├─ status.restricted        → 403 ACCOUNT_RESTRICTED
   │     ├─ roles ∩ required roles   → 403 FORBIDDEN
   │     ├─ writeAudit(success)
   │     ├─ authSession.lastActiveAt = now()      ← idle-lifetime extension
   │     └─ action(tx, requestId, caller)         ← your handler
   │  })
   │
   ├─ headers: x-request-id, cache-control: private, no-store
   └─ on throw → 503 UNAVAILABLE + audit(result: 'failed')
   ▼
PostgreSQL via pg.Pool
```

Two consequences worth internalising:

1. **Authorization and the write are atomic.** The audit row and the business
   write commit together, or neither does. Rejections are audited *after* the
   rollback so a refused request still leaves a trace.
2. **`hasSameOrigin()` compares the `Origin` header to `NEXTAUTH_URL`'s origin**
   and rejects `sec-fetch-site: cross-site`. In production `NEXTAUTH_URL` must be
   the *exact* public origin (`https://your-domain`, no trailing slash, no `www`
   mismatch) or every mutating request will 403 with `ORIGIN_REJECTED`.

---

## 4. The API surface

**31 route handlers** under `app/api/`. Each is a plain Next.js route module;
there is no separate REST server to deploy.

### 4.1 Route table

| Route | Verbs | Allowed roles (from the code) |
|---|---|---|
| `/api/auth/[...nextauth]` | NextAuth | — (Google callback + session) |
| `/api/me` | GET | any signed-in account (own status) |
| `/api/me/profile` | GET, PATCH | member, admin, staff, trainer |
| `/api/demo-session` | GET, POST, DELETE | — (dev/demo only) |
| `/api/members` | GET, POST | GET: admin/staff/trainer · POST: **admin/staff** |
| `/api/members/[id]` | GET, PATCH, DELETE | GET/PATCH: admin/staff; DELETE: **admin only** |
| `/api/members/[id]/membership` | GET, POST, PATCH | GET: +trainer/member · POST/PATCH: **admin/staff** |
| `/api/checkins` | GET, POST | GET: admin/staff/trainer · POST: **admin/staff** |
| `/api/orders` | GET, POST | **admin, staff** |
| `/api/orders/[id]/payments` | GET, POST | **admin, staff** |
| `/api/orders/[id]/refund` | POST | **admin only** |
| `/api/gym-plans` | GET, POST, PATCH | GET: admin/superadmin · write: admin/superadmin |
| `/api/promotions` | GET, POST | GET: +member · POST: admin/staff |
| `/api/promotions/[id]` | PATCH, DELETE | PATCH: admin/staff · DELETE: admin |
| `/api/promotions/[id]/claim` | POST | **member** |
| `/api/bookings` | GET, POST | admin/staff/trainer/member |
| `/api/bookings/[id]` | PATCH | admin/staff/trainer |
| `/api/trainers` | GET, POST | GET: +member · POST: admin |
| `/api/trainers/[id]` | PATCH, DELETE | admin |
| `/api/trainers/[id]/availability` | GET, POST, DELETE | GET: all roles · write: admin/trainer |
| `/api/trainers/[id]/reviews` | GET, POST | GET: all roles · POST: **member** |
| `/api/sessions` | GET, DELETE | admin, superadmin |
| `/api/staff` | GET, POST | admin |
| `/api/staff/[id]` | PATCH, DELETE | admin |
| `/api/admins` | GET | admin, superadmin |
| `/api/superadmins` | GET | admin, superadmin |
| `/api/audit` | GET | admin |
| `/api/notifications` | GET, POST, PATCH | GET/PATCH: all roles · POST: admin/staff |
| `/api/student-verifications` | GET, POST | GET: admin/staff · POST: **member** |
| `/api/student-verifications/[id]` | PATCH | admin, staff |
| `/api/qr-destinations` | GET, POST, PATCH, DELETE | GET/POST/PATCH: admin/staff · DELETE: admin |

Empty directories with **no** `route.ts` (planned, unimplemented):
`app/api/availability`, `app/api/links`, `app/api/payments`, `app/api/reports`,
`app/api/verification`.

### 4.2 The error contract

All business routes return the same envelope via `apiError()`:

```json
{ "code": "UNAUTHENTICATED", "message": "Sign in with an authorized Account.", "requestId": "…" }
```

| Status | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHENTICATED` | no valid session cookie |
| 403 | `ORIGIN_REJECTED` | `Origin` ≠ `NEXTAUTH_URL` origin, or cross-site fetch |
| 403 | `ACCOUNT_RESTRICTED` | account exists but must complete required steps |
| 403 | `FORBIDDEN` | signed in, but role not permitted |
| 400 | — | malformed JSON / missing required field |
| 409 | — | conflict (e.g. already checked in today) |
| 503 | `UNAVAILABLE` | business transaction threw; real cause is in server logs under `requestId` |

The `requestId` is echoed in the `x-request-id` response header and stored on the
audit row, so a user-visible failure can be traced to one log line.

### 4.3 Money rules (a real source of bugs)

- **The API speaks integer centavos.** `unitPrice`, `totalPrice`, `amount`,
  `totalAmount` are all integer centavos.
- **The UI speaks peso floats.** Convert at the boundary only:
  `Math.round(peso * 100)`.
- `OrderLine.totalPrice = quantity × unitPrice` is computed **server-side**; the
  client's total is not trusted.
- **`Transaction.status` ≠ payment status.** `TxnStatus` is
  `Paid | Pending | Refunded | Failed`. `Successful | Processing` belong to
  `PaymentStatus`. Map it: `paymentState === 'Successful' ? 'Paid' : 'Pending'`.

### 4.4 Two different IDs (the other classic bug)

| Endpoint family | Expects |
|---|---|
| `/api/checkins`, `/api/orders` | numeric **`gymUserId`** (integer) |
| `/api/members/[id]`, `/api/members/[id]/membership` | **`MemberProfile` cuid** |
| What the UI shows | display number, e.g. `M-1042` |

`resolveGymUserId(memberId)` in `src/lib/api-client.ts` bridges display number →
`gymUserId`. Any new screen that writes must use it rather than passing `M-1042`
straight through.

### 4.5 Order creation is serialized

`POST /api/orders` takes a Postgres advisory lock before inserting:

```sql
SELECT pg_advisory_xact_lock(hashtextextended('order:create', 0))
```

This serializes order creation (receipt-numbering safety) and is released at
transaction end. It only works because the request already runs inside
`prisma.$transaction` — a detail to preserve if that route is ever refactored.

---

## 5. The data layer

### 5.1 How Prisma is wired

```prisma
// backend/prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../generated/prisma/client"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

```ts
// backend/lib/prisma.ts  (the ONLY client the app uses)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const schema = new URL(connectionString).Params.get('schema') ?? 'public';
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
```

Points that matter operationally:

- **`DATABASE_URL` is mandatory** — the module throws at import time if missing.
- The adapter reads **`?schema=`** from the URL; `pg` itself ignores it, so the
  adapter is told explicitly. **Keep `?schema=public` in the URL.**
- The `Pool` and client are cached on `globalThis` **only outside production**
  (dev hot-reload guard). In production a fresh module evaluation is fine.
- **One `pg.Pool` per process.** On a long-lived Node server (Railway/Render/
  Fly/VM) that is ideal. On serverless (Vercel/Lambda) every instance opens its
  own pool — use a pooled endpoint or a small `connection_limit`.
- The generated client lives in `backend/generated/prisma/client/`, is
  **git-ignored**, and is regenerated by `postinstall` and `build`.

### 5.2 Schema shape — 30 models, 15 enums

Single `public` schema. Grouped by concern:

**Identity & auth (S01)** — `AuthUser`, `AuthAccount`, `AuthSession`,
`AuthVerificationToken`, `AccountStatus`, `RoleProfile`, `AssignedRole`,
`AuditEvent`, plus the legacy integer-keyed `User` / `Post` (the README flags
`Post` as an unused sample). The split is deliberate: gym tables key on integers,
Auth.js tables key on strings, and `src/auth/adapter.ts` maps between them with a
`Proxy` (`user → authUser`, `account → authAccount`, …).

**Gym domain** — `MemberProfile` (holds `gymUserId` + the display number),
`TrainerProfile`, `StaffProfile`, `GymPlan`, `Membership`.

**Commerce** — `Order`, `OrderLine`, `Payment`, `Promotion`,
`PromotionClaim`, `OrderPromotionApplication`.

**Operations** — `TrainerAvailability`, `Booking`, `TrainerReview`, `CheckIn`,
`MemberMeasurement`, `StudentVerification`, `GymLink`, `Notification`,
`NotificationPreference`, `Asset`.

### 5.3 Enums (the vocabulary of the domain)

| Enum | Values |
|---|---|
| `AccountStatus` | enabled, disabled |
| `GymRole` | member, staff, trainer, admin, superadmin |
| `TrainerStatus` / `StaffStatus` | Active, OnLeave, Inactive |
| `MembershipStatus` | Active, Expiring, Frozen, Expired, Cancelled |
| `OrderSource` | MemberCheckout, POS, AdminAssignment |
| `OrderStatus` | Pending, Processing, Paid, PartiallyRefunded, Refunded, Cancelled, Failed |
| `PaymentMethod` | Cash, GCash, Card |
| `PaymentStatus` | Pending, Processing, Successful, Failed, Refunded |
| `DiscountType` | Percentage, Fixed, Bundle |
| `PromotionStatus` | Draft, Published, Expired |
| `AvailabilityStatus` | available, unavailable, booked |
| `BookingStatus` | Pending, Confirmed, Cancelled, Completed, NoShow |
| `CheckInSource` | Self, Staff |
| `VerificationStatus` | Submitted, UnderReview, Approved, Rejected, Expired |

### 5.4 Migrations — 7, all committed

`backend/prisma/migrations/`

| # | Migration | What it did |
|---|---|---|
| 1 | `20261007023716_init` | base tables |
| 2 | `20261017150000_authjs_google` | Auth.js tables for Google |
| 3 | `20261018100000_gym_plan_limit` | active-plan cap support |
| 4 | `20261021120000_canonical_account` | Account + gym identity, collision guards |
| 5 | `20261021160000_shared_sessions` | shared session semantics |
| 6 | `20261022140000_gym_domain_models` | memberships, orders, payments, bookings, check-ins… |
| 7 | `20261022160000_updated_at_defaults` | `updatedAt` defaults |

Migration history is **the source of truth** — never `db push` against production.

### 5.5 The Prisma wrapper

All Prisma CLI invocations go through `scripts/prisma.mjs`, which loads the root
`.env*` files with Next's own loader (`@next/env`) so Prisma and Next read the
**same** configuration, then pins `--schema=backend/prisma/schema.prisma`.
**Real environment variables win over `.env` files**, which is why inline
`DATABASE_URL=… npm run db:migrate` is safe.

---

## 6. Authentication & identity

| Concern | Implementation |
|---|---|
| Provider | Google only, and **only if** `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set; otherwise the provider list is empty and the login page hides it |
| Hardening | `checks: ['pkce','state']`, `prompt: 'select_account'`, `allowDangerousEmailAccountLinking: false` |
| Identity proof | `signIn` requires `email_verified === true` **and** `profile.sub === account.providerAccountId`; otherwise the callback is rejected and audited |
| Sessions | **Database** strategy, `maxAge` 30 days, `updateAge` 24 h; rolling refresh cannot extend either bound (`adapter.updateSession` returns the stored session unchanged) |
| Session read | `session` callback re-reads the cookie's session from Postgres and **throws `Account unavailable`** if the record is missing or belongs to another user |
| Provisioning | `adapter.createUser` and `adapter.linkAccount` **throw on purpose** — accounts are created only by `establishGoogleAccount()` inside a transaction, so NextAuth can never silently create or link one |
| Roles | Stored in `AssignedRole`. **Environment role settings are ignored at runtime.** |
| Demo logins | `DEMO_ACCOUNTS_ENABLED`; signed HTTP-only cookie; disabled on Vercel Production; **cannot** authorize real mutations |
| Restricted accounts | `ACCOUNT_RESTRICTED` until required steps complete |

**Consequence for deployment:** a freshly migrated database has **no admins**. You
must sign in once (which creates the account) and then run the reviewed importer
`node scripts/account-cutover.mjs` — see `docs/account-cutover.md`. The importer
requires a plan file, an operator id, and takes a re-checked snapshot under locks;
the report contains personal data, so keep it private and never commit it.

---

## 7. Audit and observability

- Every authorized call writes an `AuditEvent` row: actor, action, target,
  result, `requestId`, DB server time. Rejections are recorded too.
- `withBusinessAuthorization` logs the real exception server-side and returns a
  generic `503 UNAVAILABLE` with the same `requestId` — always grep that id.
- If audit storage itself fails, authentication **fails closed**.
- There is **no APM, no metrics endpoint, no log aggregation** configured. The
  Express scaffold has `/api/health`, but the Next app does not expose a health
  endpoint — worth adding for any uptime monitor.

---

## 8. What `backend/` actually is (so nobody deploys the wrong thing)

The separate Express scaffold in `backend/src/`:

- `app.ts` — `express.json()`, `cors({ origin: process.env.FRONTEND_URL, credentials: true })`,
  request logger, and **`GET /api/health` returning `{ status: 'ok' }`**. That is
  the entire API.
- `server.ts` — `app.listen(process.env.PORT || 3000)`.
- README, verbatim: *"The separate `backend/` Express scaffold does not own S01
  authentication."*

**Deploy the root Next.js app. The Express scaffold is optional and serves no
gym workflow.** If you deploy it anyway it needs its own port; it will collide
with the Next app on 3000.

---

## 9. Local development (today's workflow)

```bash
npm ci                       # runs postinstall → generates the Prisma client
cp .env.example .env.local   # then fill DATABASE_URL / NEXTAUTH_* / GOOGLE_*
npm run db:migrate           # apply the 7 migrations
npm run dev                  # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm run db:generate` | generate the client, no migration |
| `npm run db:validate` | validate the schema |
| `npm run db:migrate` | **`migrate deploy`** — apply committed migrations |
| `npm run db:status` | migration status of the configured DB |
| `npm run db:migrate:dev -- --name <n>` | author a new migration (dev only) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run test:unit` | 43 tests |
| `npm run test:integration` | 26 tests; builds the app, spins a disposable PostgreSQL |
| `npm run build` / `npm start` | production build / serve |

**Integration-test caveat (hit repeatedly):** the suite needs exclusive access to
`query_engine-windows.dll.node`. A running dev server on `:3000`/`:3001` causes
`EPERM`. Kill the dev server first.

**Current verified state:** typecheck 0 errors, unit 43/43, integration 26/26.

---

## 10. Running it always online — what is actually left to do

### 10.1 Already true (no work needed)

- [x] Single deployable: the Next.js root app serves UI + API.
- [x] DB location is a single env var; no localhost assumptions anywhere.
- [x] 7 migrations committed; `migrate deploy` is the documented path.
- [x] Prisma client regenerates automatically on `npm ci` and `npm run build`.
- [x] Production has no embedded-Postgres dependency — that is a **devDependency
      used only by the test harness**.
- [x] Every business route is behind an auth gate with origin checking and audit.

### 10.2 Required for a live deployment

| # | Task | Detail |
|---|---|---|
| 1 | **Provision managed PostgreSQL** | Neon, Supabase, Railway, Render, Aiven, RDS — any work. Prefer a **direct** connection if the app runs as a long-lived Node server; use the **pooled** endpoint on serverless. |
| 2 | **Set `DATABASE_URL`** | Append `?schema=public`; add `&sslmode=require` if the provider requires TLS. The adapter parses `schema`, so dropping it can point queries at the wrong schema. |
| 3 | **Apply migrations once** | `DATABASE_URL="postgresql://…?schema=public" npm run db:migrate` then verify with `npm run db:status`. Never `db push`. Never `db:migrate:dev` against prod. |
| 4 | **Set the environment contract** | see 10.3 |
| 5 | **Google OAuth redirect URI** | Add `https://<domain>/api/auth/callback/google` in Google Cloud Console (keep the localhost one). Missing → `redirect_uri_mismatch`. |
| 6 | **Bootstrap roles** | Sign in once with Google, then run `scripts/account-cutover.mjs` (`plan` → review → `apply`). Without this the prod DB has no admins. Keep reports private. |
| 7 | **`DEMO_ACCOUNTS_ENABLED=false`** | Demo logins are sample identities and must not exist in production. |
| 8 | **Push the code** | `f1db950` is committed but **not pushed**. Git-based hosts deploy from the remote. |
| 9 | **Add platform config** | The repo currently has **no** `Dockerfile`, `vercel.json`, `railway.json`, `render.yaml`, `Procfile`, or `fly.toml`. One has to be added for whichever host you choose. |
| 10 | **TLS + custom domain** | Terminate TLS at the platform; then `NEXTAUTH_URL` must equal that exact public origin. |

### 10.3 Environment variables

| Variable | Production value | Notes |
|---|---|---|
| `DATABASE_URL` | managed Postgres URL + `?schema=public` | mandatory; app throws without it |
| `NEXTAUTH_URL` | `https://your-domain` | **must exactly match** the public origin or every mutation 403s |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | fresh; never reuse the dev value |
| `DEMO_ACCOUNTS_ENABLED` | `false` | sample logins |
| `DEMO_SESSION_SECRET` | unset | only needed if demo is deliberately enabled on a preview |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | your OAuth web client | omit both → provider disabled |
| `ACTIVE_PLAN_LIMIT` | `4` (or your real cap) | active-plan cap |
| `NEXT_PUBLIC_BOOKING_TIME_ZONE` | `Asia/Manila` | **build-time** |
| `NEXT_PUBLIC_GCASH_TEST_FEE_PHP` | `0` | **build-time** |
| `FRONTEND_URL` | only for the Express scaffold | CORS origin; unused by the Next app |
| `NODE_ENV` | `production` | also makes the Prisma wrapper stop loading `.env*` |

> `NEXT_PUBLIC_*` are **inlined at build time**. Setting them after the build does
> nothing — they must exist in the build environment.

### 10.4 Operational concerns nobody has handled yet

- **Backups / PITR** — not configured. Managed Postgres usually offers it; turn it on and record the retention window.
- **Connection limits** — one `pg.Pool` per process. Serverless needs a pooled endpoint or `connection_limit`; a long-lived server needs the pool size matched to the DB's `max_connections`.
- **Health check** — the Next app exposes none. Add one before wiring an uptime monitor.
- **Log retention** — `console.error` + `x-request-id` is the whole story. Ship logs somewhere durable.
- **Rate limiting / abuse** — none. The order lock serializes writes; it does not throttle them.
- **Email** — no transactional email provider is wired (invites, receipts, verification notices).
- **Payments** — GCash/Card are recorded as *states*, not processed through a gateway. No webhook, no reconciliation job.

### 10.5 Feature gaps that will be visible to real users

These are **not** deployment problems — they will simply not persist, because the
screens still drive local React state:

- `MemberMembership.tsx` (renew / change plan / cancel) — API wrappers already exist
- `BookingCheckoutModal.tsx`
- `MemberDashboard.tsx`, `MemberCoaching.tsx`
- `TrainerSessions.tsx`
- `SuperAdminUsers.tsx`, `SuperAdminTrash.tsx`
- `AdminPlans.tsx` still uses raw `fetch` instead of the client
- promo claim (`/api/promotions/[id]/claim`) and student verification UIs

And one genuine **backend** gap: `POST /api/orders` and
`POST /api/members/[id]/membership` are **admin/staff only**. A `member` role
cannot create an order or buy/renew a membership for themselves. Wiring
member self-serve requires an authorization decision on the server first — the UI
cannot fix it.

---

## 11. Honest readiness verdict

| Question | Answer |
|---|---|
| Can the backend run without this PC? | **Yes**, once 10.2 is done — the code is already location-independent |
| Is the data layer production-shaped? | **Yes** — committed migrations, env-only config, real audit trail |
| Is the app fully wired to the DB? | **No** — admin/staff surfaces and POS are; several member and superadmin screens are still local state (10.5) |
| Is it ready for real gym operations tomorrow? | **Not yet.** Roles need bootstrapping, backups and logging need configuring, and the member self-serve gap needs a product decision |
| Biggest single risk on go-live day | `NEXTAUTH_URL` mismatch → every mutation 403s with `ORIGIN_REJECTED` |

---

## Appendix — where things live

| Path | Contents |
|---|---|
| `app/api/**/route.ts` | all 31 HTTP handlers |
| `src/auth/http.ts` | `withBusinessAuthorization`, `apiError`, `hasSameOrigin` |
| `src/auth/options.ts` | NextAuth configuration and callbacks |
| `src/auth/adapter.ts` | Prisma adapter with the `user → authUser` proxy |
| `src/auth/sessions.ts` | session create / read / revoke |
| `src/auth/account.ts` | `establishGoogleAccount`, `normalizeEmail` |
| `backend/lib/prisma.ts` | the single Prisma client + `pg.Pool` |
| `backend/prisma/schema.prisma` | 30 models, 15 enums |
| `backend/prisma/migrations/` | 7 committed migrations |
| `scripts/prisma.mjs` | env loading + schema pinning for the CLI |
| `scripts/account-cutover.mjs` | reviewed role/identity import |
| `src/lib/api-client.ts` | the only place the UI talks HTTP |
| `docs/account-cutover.md` | role bootstrap procedure |
| `docs/database-checks.md` | what the integration suite proves |

**Related:** `README.md`, `docs/account-cutover.md`, `docs/database-checks.md`.
