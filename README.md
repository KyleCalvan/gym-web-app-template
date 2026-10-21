# VinAthletics Gym — Management System

A role-based gym management dashboard built with Next.js, React, NextAuth v4,
Prisma, and PostgreSQL. The root Next.js application owns the `/api` routes,
Google sign-in, database sessions, and persisted membership plans. The separate
`backend/` Express scaffold does not own S01 authentication.

## Getting started

Use Node.js 24 and npm. Install from the repository root:

```bash
npm ci
```

Copy the root `.env.example` to `.env.local`, configure a development PostgreSQL
`DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`, then run:

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Google sign-in additionally requires the credentials
described below. For a production build, run `npm run build` and `npm start`.

## Database tooling and checks

The sole schema and migration history live in `backend/prisma/`. Root and backend
Prisma CLI, client, and PostgreSQL adapter are pinned to **5.22.0**. The generated
client belongs in `backend/generated/prisma/client/` and is ignored by Git;
`npm ci` generates it automatically. Both application entry points use the shared
client in `backend/lib/prisma.ts`.

| Command | Purpose |
| --- | --- |
| `npm run db:generate` | Generate the client without migrating a database |
| `npm run db:validate` | Validate the canonical schema |
| `npm run db:migrate` | Apply committed migrations to the configured database |
| `npm run db:status` | Inspect the configured database's migration status |
| `npm run db:migrate:dev -- --name <name>` | Create a migration against a development database |
| `npm run typecheck` | Generate Next.js route types and check application types |
| `npm run test:unit` | Run existing Node regression tests |
| `npm run test:integration` | Build Next.js and exercise HTTP routes and migrations with disposable PostgreSQL |
| `npm test` | Run the complete regression and integration suite |

Prisma commands load the root `.env*` files through Next.js's environment loader,
even when invoked from `backend/`. Exported variables take precedence. Commands
use the development environment by default; set `NODE_ENV=production` when
deliberately using production configuration. The PostgreSQL adapter honors the
URL's `schema` parameter, matching migrations.

Integration checks require no env files, Docker, PostgreSQL service, or live OAuth
credentials. They start packaged PostgreSQL 17 binaries on a random loopback port,
build and launch the real Next.js app, and remove the disposable cluster afterward.
See [database checks](docs/database-checks.md) for coverage and prerequisites.

The optional Express scaffold can be checked separately after the root install:

```bash
npm --prefix backend ci
npm --prefix backend run typecheck
npm --prefix backend run build
```

Its build emits `backend/dist/server.js`, and `npm --prefix backend start` runs it.

## Google OAuth setup

1. Use the root `.env.local` configured above. Local env files are Git-ignored.
2. Create a Google OAuth **Web application** client in Google Cloud Console. Add these authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://<your-domain>/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`. The login screen detects provider availability from the server-side Auth.js providers endpoint; the client secret is never exposed.
4. Set `ADMIN_EMAILS` to a comma-separated list of verified Google account emails permitted to manage membership plans. Set `ACTIVE_PLAN_LIMIT` to the maximum number of active plans (defaults to `4`).
5. Optionally set `ROLE_ASSIGNMENTS` as a server-only JSON object mapping verified Google account emails to explicitly assigned role arrays, for example `{"coach@example.com":["member","trainer"],"manager@example.com":["member","admin","staff"]}`. Explicit assignments override the default member role and `ADMIN_EMAILS` fallback for those accounts. The profile menu only offers roles returned by the server-authenticated session.
6. Apply the additive Auth.js and membership-plan tables to the same Postgres database with `npm run db:migrate`, then run `npm run build` and `npm run start`.

The Google callback verifies Google's `email_verified` claim. A verified email matching an existing gym `User` is linked to that record; otherwise a gym user is created. Auth.js keeps its OAuth identities and sessions in separate tables, preserving the existing integer user IDs and `Post` relation. It does not enable dangerous email-only linking between OAuth providers. All Google sign-ins default to the member role unless an explicit server-side assignment exists; an address in `ADMIN_EMAILS` receives member and admin roles unless overridden by `ROLE_ASSIGNMENTS`. The client cannot add roles by selecting an interface. Membership-plan mutations require an authenticated session carrying an assigned admin or superadmin role. The initial plan catalog is copied into the new plan table on its first API read if that table is empty.

During local development, the role selector offers these server-validated demo accounts: `member@vinathletics.gym` / `member123`, `staff@vinathletics.gym` / `staff123`, `trainer@vinathletics.gym` / `trainer123`, `admin@vinathletics.gym` / `admin123`, and `superadmin@vinathletics.gym` / `superadmin123`. Demo sessions are signed and stored in an HTTP-only cookie; they use `DEMO_SESSION_SECRET` or `NEXTAUTH_SECRET` when configured, with a local-development-only fallback otherwise. Demo login is always disabled on Vercel Production. To enable it on a Vercel Preview deployment, set `DEMO_ACCOUNTS_ENABLED=true` and a strong `DEMO_SESSION_SECRET` in the Preview-only environment variables. Use a separate Preview database; the demo Admin and Super Admin can access plan-management endpoints. Demo login can be disabled in local development with `DEMO_ACCOUNTS_ENABLED=false`. These are sample accounts and must never be treated as real user identities. Other screens and mutations that still operate only on in-memory demo state are not production backend workflows; any future persistent or sensitive action must be moved behind an authenticated server endpoint with the matching role check and durable audit logging.
