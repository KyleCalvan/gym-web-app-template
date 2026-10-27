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

For a protected online team preview, follow the
[preview deployment guide](docs/preview-deployment.md).

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
4. Set `ACTIVE_PLAN_LIMIT` to the maximum number of active plans (defaults to `4`). Assigned Roles are authoritative in PostgreSQL. Existing installations must follow the [reviewed Account cutover](docs/account-cutover.md) to report identity collisions and import old environment assignments explicitly.
5. Apply migrations to the same PostgreSQL database with `npm run db:migrate`, then run `npm run build` and `npm run start`.

The Google callback verifies Google's `email_verified` claim and atomically establishes a durable Account, gym identity, provider link, verified-email evidence, member role/profile, and audit events. Existing provider mappings are preserved by ID. Matching emails do not silently merge or claim records. New Accounts receive only member authority and no purchased Membership. Restricted and legacy sessions see limited Account status and next steps through `/api/me` and `/account`; they cannot enter the sample dashboard or mutate plans. Environment role settings no longer override database assignments. Profile/terms completion and authenticator support are delivered in subsequent S01 slices. The plan catalog is read from PostgreSQL.

<<<<<<< HEAD
## Registration verification email

Create Account sends a one-time verification link to the address entered in the registration form. The account stays restricted until the recipient opens the link. To send these messages through Gmail, enable 2-Step Verification on the sending Google Account and create an App Password. In the root `.env.local`, set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER` to that Gmail address, `SMTP_PASSWORD` to its App Password without display spaces, and `SMTP_FROM` to `VinAthletics <the-same-gmail-address>`. Set `NEXTAUTH_URL` to the public address users should open, then restart the app. Keep the App Password out of committed files and browser variables. Google OAuth credentials alone do not send email.

If delivery fails after account creation, the account page offers **Resend verification email**. A working SMTP configuration is required before registration can start.

During local development, the role selector offers these server-validated demo accounts: `member@vinathletics.gym` / `member123`, `staff@vinathletics.gym` / `staff123`, `trainer@vinathletics.gym` / `trainer123`, `admin@vinathletics.gym` / `admin123`, and `superadmin@vinathletics.gym` / `superadmin123`. Demo sessions are signed and stored in an HTTP-only cookie; they use `DEMO_SESSION_SECRET` or `NEXTAUTH_SECRET` when configured, with a local-development-only fallback otherwise. Demo login is always disabled on Vercel Production. To enable it on a Vercel Preview deployment, set `DEMO_ACCOUNTS_ENABLED=true` and a strong `DEMO_SESSION_SECRET` in the Preview-only environment variables. Use a separate Preview database. Demo cookies cannot authorize real plan mutations or Account-status APIs. Demo login can be disabled in local development with `DEMO_ACCOUNTS_ENABLED=false`. These are sample accounts and must never be treated as real user identities. Other screens and mutations that still operate only on in-memory demo state are not production backend workflows; any future persistent or sensitive action must be moved behind an authenticated server endpoint with the matching role check and durable audit logging.
=======
Sign-in uses PostgreSQL-backed Accounts only. Register a member with configured email verification or Google OAuth; staff and administrator roles require an authorized database assignment. Interface examples that still use in-memory state are not persistent backend workflows.
>>>>>>> 9f37355 (fixed login and verified user roles ui and added users in the database)
