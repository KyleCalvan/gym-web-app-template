# How VinAthletics Actually Works

### A plain-English guide to the backend and the database

> Written 2026-10-24. This is the **readable** version. If you want the exhaustive
> reference — every route, every model, every enum — that lives in
> [`backend-and-database.md`](./backend-and-database.md). This file explains the same
> system in a way you can read start to finish without a technical background.

---

## The 30-second version

VinAthletics is **one program**, not two. The same Next.js application that draws the
screens also answers every API call and talks to the database. There is no separate
"backend server" to babysit.

All the real data — members, orders, payments, memberships, check-ins, and who is
allowed to do what — lives in **one PostgreSQL database**. The application keeps no
important state of its own. That is why it can move off your computer and onto a
hosting service without rewriting anything: you point it at a different database
address and it just works.

---

## Think of it as a restaurant

The easiest way to understand the pieces is to compare the app to a restaurant.

| Restaurant | VinAthletics | What it does |
|---|---|---|
| **Dining room** | The React UI in `src/` | What the customer sees and touches |
| **Waiter** | The Next.js `/api` routes | Takes the order, checks you're allowed, carries it back |
| **Kitchen** | `src/auth/` + the route handlers | Does the actual work: creates the order, takes the payment |
| **Pantry** | **PostgreSQL** | Where every ingredient (all the data) is stored |
| **Head chef's rulebook** | `backend/prisma/schema.prisma` | Defines exactly what can be stored and in what shape |
| **The health inspector** | `AuditEvent` table | Writes down every decision, including refusals |
| **A second, empty kitchen** | `backend/src/` (Express) | Exists but only serves water (`/api/health`). Ignore it. |

The important part: **the waiter never cooks, and the kitchen never guesses.** Every
request is checked before any work happens, and every piece of work is written down.

---

## Follow one real request: a staff member charges at the POS

This is the clearest way to see how all the parts fit together. Trace a single click.

### 1. The click

A staff member at the front desk rings up a Premium membership and hits **Charge**.

The React screen calls `createOrder(...)` from `src/lib/api-client.ts`. That sends an
HTTP `POST` to `/api/orders`, and — crucially — the browser automatically attaches the
staff member's **session cookie**. That cookie is the only proof of who they are.

### 2. The gatekeeper

Before any real code runs, the request enters `withBusinessAuthorization()` in
`src/auth/http.ts`. Think of this as a bouncer who checks five things, in order:

1. **Is there a valid session?** No → `401 UNAUTHENTICATED`.
2. **Did this request come from our own website?** No → `403 ORIGIN_REJECTED`.
   This is what stops another site from quietly making requests on a logged-in user's
   behalf.
3. **Is the account restricted?** Yes → `403 ACCOUNT_RESTRICTED`.
4. **Does this person hold an allowed role?** `/api/orders` allows only `admin` and
   `staff`. A member gets `403 FORBIDDEN`.
5. **All good?** Write an audit row saying "allowed", then run the handler.

Everything above happens **inside a single database transaction**. That means the audit
row and the actual order are saved together — or neither is saved at all. There is no
state where the order exists but the log doesn't, or the reverse.

### 3. The work

The order handler:

1. Takes a Postgres **advisory lock** so two staff members can't create order #1042 at
   the same instant. (More on this below.)
2. Computes every line total **on the server**: `quantity × unitPrice`. The browser's
   numbers are never trusted.
3. Creates the `Order` row and its `OrderLine` rows in one go.
4. Writes an `AuditEvent` saying "order.created".
5. Returns `201` with the finished order.

### 4. The reply

Every response carries an `x-request-id` header. If something goes wrong later, that ID
appears in the server log next to the real error, so one string is all you need to
trace a failure.

### 5. The database write

Prisma turns that JavaScript into SQL, the `pg` driver sends it over a connection pool
to PostgreSQL, and the rows land on disk. When the transaction commits, the order is
real. If anything threw along the way, the whole thing rolled back and the customer
was never charged.

---

## The database, explained without jargon

### It's one schema, thirty tables

A "schema" is just a namespace for tables. VinAthletics uses a single one called
`public` — no clever partitioning, nothing to get confused about. There are **30
tables** (Prisma calls them *models*), and they fall into four groups.

**Who you are (identity).** `AuthUser`, `AuthAccount`, `AuthSession`, `AssignedRole`,
`AuditEvent`. This group is unusual and worth understanding, because it's the part
that most often confuses people.

There are actually **two identity systems** living side by side:

- The older gym tables (`User`) use **whole numbers** as IDs — 1, 2, 3…
- The login system NextAuth brings (`AuthUser`) uses **long strings** as IDs.

Rather than rewrite the gym tables, the project hides the difference with a small
translator in `src/auth/adapter.ts`. When NextAuth asks for "the user table", it is
quietly handed `AuthUser` instead. The gym code keeps using its numbers. Neither side
knows the other exists.

**The gym's people.** `MemberProfile`, `TrainerProfile`, `StaffProfile`, `GymPlan`,
`Membership`. Notice that a member's profile is separate from their login account:
the account is *how they sign in*, the profile is *who they are at the gym*.

**Money.** `Order`, `OrderLine`, `Payment`, `Promotion`, `PromotionClaim`,
`OrderPromotionApplication`. An **Order** is the receipt. Its **OrderLines** are the
items on it. A **Payment** is money actually received against it. Keeping those three
separate is what makes refunds and partial payments possible later.

**Day-to-day operations.** `CheckIn`, `Booking`, `TrainerAvailability`, `TrainerReview`,
`MemberMeasurement`, `StudentVerification`, `Notification`, and a few others.

### One connection, one address

The entire database connection is 27 lines in `backend/lib/prisma.ts`. It reads a
single environment variable, `DATABASE_URL`, and opens a pool of connections. If the
variable is missing, the app refuses to start — a deliberate, loud failure rather than
a mysterious one later.

**This is the whole reason the app is portable.** There is no `localhost` hard-coded
anywhere. Point `DATABASE_URL` at your laptop and it runs on your laptop. Point it at
Neon, Supabase, Railway, or AWS and it runs there. Same code.

One detail that trips people up: Prisma lets you name a schema in the URL with
`?schema=public`. The `pg` driver ignores that parameter, so the adapter reads it
manually and passes it along. **Keep `?schema=public` on the end of your connection
string.** Drop it and queries can end up looking in the wrong place.

### History is recorded as migrations

A **migration** is a saved, numbered instruction for changing the database — "add this
table", "add this column". There are **7 of them**, and they are committed to the repo,
which means any fresh database can be brought up to date by replaying them in order.

This matters for deployment more than anything else in this document. In production you
run `npm run db:migrate`, which replays those 7 files and stops. You never run
`db push`, and you never run the development migration command against a live database
— either one can quietly destroy data.

---

## The technology, and why each piece is there

**Next.js 16 (with React).** The framework. Its job is to serve both the screens and
the API from one process. This is why deployment is simple: one build, one start
command, one thing to keep alive.

**NextAuth v4 with Google.** Handles "sign in with Google". It is configured in
**database session mode**, which means the session itself is a row in Postgres rather
than a signed token in the browser. The practical benefit: you can revoke someone's
access instantly by deleting the row. With token-based sessions you cannot.

**Prisma 5.22.** The translator between JavaScript and SQL. You describe your tables
in `schema.prisma`; Prisma writes the SQL, generates a typed client, and manages the
migrations. It is pinned to an exact version in both `package.json` files, so a fresh
install behaves identically to yours.

**`pg` with Prisma's driver adapter.** Normally Prisma ships its own database engine.
This project instead uses the standard Node Postgres driver, `pg`, through an adapter.
The effect is an ordinary connection pool you can reason about, and one fewer moving
part at runtime.

**PostgreSQL.** The database itself. Any managed provider works, version 14 or newer.

**Node's built-in test runner.** Two suites: 43 unit tests that need nothing, and 26
integration tests that spin up a temporary throwaway Postgres, build the real app, and
call it over HTTP. That second suite is why you can trust that the wiring actually
works rather than merely compiles.

---

## Who is allowed to do what

The five roles are `member`, `staff`, `trainer`, `admin`, and `superadmin`. Roles are
stored **in the database**, in the `AssignedRole` table. Environment variables that
look like they set roles are ignored — a deliberate choice, so a misconfigured server
can't accidentally hand out admin.

The practical consequences:

- A **member** can see their own profile, claim promotions, write trainer reviews,
  submit student verification, and book sessions.
- **Staff** can register members, check people in, take payments, and create orders.
- **Trainers** can see their schedules and set availability.
- **Admins** can do everything staff can, plus manage plans, staff, trainers, refunds,
  and read the audit log.
- **Superadmins** additionally manage sessions and other admin accounts.

> ⚠️ **The one real gap:** `POST /api/orders` and
> `POST /api/members/[id]/membership` allow only admin and staff. A member **cannot
> buy or renew a membership for themselves** through the API today. This is not a bug
> in the screens — it is a decision that hasn't been made yet on the server. Fixing it
> means deciding whether members may self-purchase, then changing the role list on
> those two routes.

---

## Where the money lives

Two rules prevent almost every financial bug.

**Rule one: the API counts in centavos.** Every amount that crosses the API — unit
price, line total, payment amount — is a whole number of centavos. The screens show
pesos, so the conversion happens at the very edge: `Math.round(pesos * 100)` going in,
divide by 100 going out. Never store or send a peso decimal.

**Rule two: "how the order is doing" and "how the payment went" are different words.**
An order's status is one of `Pending`, `Processing`, `Paid`, `PartiallyRefunded`,
`Refunded`, `Cancelled`, `Failed`. A payment's status is one of `Pending`, `Processing`,
`Successful`, `Failed`, `Refunded`. Writing `Successful` on an order — or `Paid` on a
payment — is a mistake that has already happened once in this project.

There is also an **ID trap**. Three different identifiers are in play:

| What you have | What some endpoints want |
|---|---|
| The display number a human reads, like `M-1042` | — |
| The gym's internal integer, `gymUserId` | `/api/orders`, `/api/checkins` |
| The profile's string ID (a cuid) | `/api/members/[id]/membership` |

The helper `resolveGymUserId()` converts the display number into the integer. Any new
screen that writes data should use it rather than passing `M-1042` straight through.

Finally, order creation takes a **Postgres advisory lock**. In plain terms, it makes
simultaneous order creation line up single-file for a moment, so two receipts can never
get the same number. The lock releases automatically when the transaction ends.

---

## What happens when you sign in

1. You click "Sign in with Google". The browser goes to Google.
2. Google sends you back with a proof of identity. NextAuth verifies it, including that
   the email is verified and that the Google account ID matches.
3. Because `createUser` and `linkAccount` are deliberately disabled in the adapter, the
   app's own `establishGoogleAccount()` function creates the account — inside a
   transaction, with the role assignment and audit entry.
4. A session row is written to `AuthSession`, and a cookie holding its token goes to
   your browser.
5. On every later request, that cookie is looked up in the database. If the row is gone,
   you're signed out immediately — exactly the behaviour you want when revoking access.

Sessions last at most 30 days, and their idle timer refreshes at most once a day.
Neither limit can be extended by a rolling refresh — a deliberate hardening choice.

**One consequence for launch:** a brand-new database has **zero admins**. After you
migrate production, you sign in once with Google to create your account, then run
`scripts/account-cutover.mjs` to grant yourself a role. There is no automatic
first-admin bootstrap. The report it produces contains personal data, so keep it
private.

---

## Running it 24/7 — the honest checklist

### What already works in your favour

- ✅ **One thing to deploy.** The Next app serves the screens and the API.
- ✅ **No hard-coded addresses.** The database location is one variable.
- ✅ **Migrations are committed.** A fresh database can always be brought up to date.
- ✅ **The database client rebuilds itself** on install and on build.
- ✅ **No embedded database in production.** The bundled Postgres is a test-only tool.
- ✅ **Every write is gated and audited.**

### What you actually have to do

**1. Get a hosted PostgreSQL.** Neon, Supabase, Railway, Render, Aiven, or RDS all
work. If you're unsure, pick the one that also hosts your app so there's one bill and
one dashboard.

**2. Set `DATABASE_URL`** to the connection string they give you, ending in
`?schema=public`. Add `&sslmode=require` if they insist on TLS.

**3. Run the migrations once.** `npm run db:migrate`, then confirm with
`npm run db:status`. This is the step people skip and then wonder why every page 500s.

**4. Fill in the environment variables.** At minimum: `DATABASE_URL`, `NEXTAUTH_URL`,
a fresh `NEXTAUTH_SECRET`, `DEMO_ACCOUNTS_ENABLED=false`, and your Google client ID and
secret. The `NEXT_PUBLIC_*` variables are baked in **at build time** — setting them
afterwards does nothing.

**5. Register the production redirect URI** in Google Cloud Console:
`https://your-domain/api/auth/callback/google`. Keep the localhost one for development.

**6. Create your admin.** Sign in once with Google, then run the account-cutover script.

**7. Turn demo logins off.** `DEMO_ACCOUNTS_ENABLED=false`. The sample accounts are
publicly known credentials.

**8. Push the code.** The work is committed locally but not pushed. Hosts that deploy
from Git need it on the remote.

**9. Add a host configuration file.** The repo currently has **none** — no `Dockerfile`,
no `vercel.json`, no `railway.json`. Whatever host you choose, it will want one. This is
the main missing piece between "works on my machine" and "works on the internet".

**10. Point a domain at it and set `NEXTAUTH_URL` to that exact address.**

### The trap that will bite you on launch day

The app checks that mutating requests come from its own origin. It does that by
comparing the browser's `Origin` header against `NEXTAUTH_URL`.

If `NEXTAUTH_URL` is `https://example.com` but people reach the site at
`https://www.example.com`, then **every save, every payment, every registration fails
with a 403** — while the site itself looks completely fine and lets you browse. It is
the single most likely cause of a confusing first-day outage. Set it exactly, with no
trailing slash.

---

## Things nobody has set up yet

These aren't bugs; they're simply not built. None of them block launch for a small gym,
but all of them matter at some point.

| Missing | Why it matters |
|---|---|
| **Backups and point-in-time recovery** | Managed Postgres usually offers it — switch it on |
| **A health-check endpoint** | The Next app doesn't have one, so uptime monitors have nothing to ping |
| **Centralized logs** | Right now errors live in the terminal; a restart erases the evidence |
| **Rate limiting** | Nothing stops someone hammering the login or order endpoints |
| **Transactional email** | No receipts, invites, or verification emails are sent |
| **A real payment gateway** | GCash and Card are recorded as *states*. No money actually moves |

### Screens that still run on demo data

These will work in a demo and lose their changes on refresh:

`MemberMembership` (renew, change plan, cancel) · `BookingCheckoutModal` ·
`MemberDashboard` · `MemberCoaching` · `TrainerSessions` · `SuperAdminUsers` ·
`SuperAdminTrash` · the promo-claim flow · student verification.

The API endpoints for most of these already exist and are tested. The remaining work is
connecting the screens to them, which is mechanical rather than architectural.

---

## Glossary

**API route** — a URL the application answers, like `/api/orders`. There are 31.

**Migration** — a numbered file describing a database change. Applied in order.

**Model** — one table in the database, described in `schema.prisma`. There are 30.

**Prisma** — the tool that turns JavaScript calls into SQL and keeps the schema in sync.

**Session** — proof that you're signed in. Here it's a row in the database, referenced
by a cookie.

**Transaction** — a group of database changes that all succeed or all fail together.

**Centavos** — hundredths of a peso. The API's unit for all money.

**`gymUserId`** — the gym's internal whole-number identifier for a person.

**Cuid** — the long string identifier used by profile records.

**Role** — one of member, staff, trainer, admin, superadmin. Stored in the database.

---

## Where to go next

- **The exhaustive reference** — [`backend-and-database.md`](./backend-and-database.md):
  every route, every model, every enum, every error code.
- **Role setup** — [`account-cutover.md`](./account-cutover.md): the reviewed procedure
  for granting the first admin.
- **What the tests prove** — [`database-checks.md`](./database-checks.md).
- **Day-to-day commands** — the root `README.md`.
