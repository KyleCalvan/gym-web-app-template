# Database-backed checks

Run `npm ci`, then `npm test` from the repository root. No `.env` files or running
database are needed. For a focused run, use `npm run test:integration`; for a
single integration file, use `node --test tests/integration/application.test.mjs`.
The regression suite alone is `npm run test:unit`.

`.github/workflows/checks.yml` runs clean installs, root/backend typechecks, the
Express scaffold build, and the complete suite on an Ubuntu runner with Node 24.

## Requirements

- Node.js 24, npm, and a platform supported by the pinned `embedded-postgres`
  distribution (Windows x64, macOS x64/arm64, or supported Linux architectures).
- Package installation must include optional dependencies and their install
  scripts, which provide the native PostgreSQL binaries and required symlinks.
- On Linux/macOS, run as a non-root user. The harness never creates OS users.
- The existing `next/font/google` setup downloads fonts during a clean Next.js
  build, so the first build requires access to Google's font servers.

The integration suite runs `next build` and `next start`, not an Express server or
imported route handlers. It uses the normal `.next` directory; run it separately
from other builds or production servers using that directory.

## Isolation

The harness creates a new cluster under the system temporary directory with a
random port and password, SCRAM authentication, and a loopback-only listener.
It constructs every database URL from that cluster. There is no test database URL
setting or fallback to an existing PostgreSQL service. Inherited `DATABASE_URL`,
`PG*`, OAuth, role, and NextAuth settings are excluded from child environments.
Explicit test values override `.env*` values in Prisma and Next.js processes.
Generation also runs with this isolated configuration.

Only fixture setup and migration preservation checks use SQL directly. Application
assertions use real HTTP responses with the actual Prisma adapter and database.
The harness invokes the packaged PostgreSQL binaries directly, avoiding the
wrapper's global exit hooks so unfinished Node tests cannot silently pass.
Normal teardown stops the application before stopping PostgreSQL and removes only
the cluster's temporary directory. An interrupted process may leave a temporary
directory or PostgreSQL process; use that directory's `postmaster.pid` to identify
the disposable instance before cleaning it up.

## Coverage

- Apply all committed migrations to a fresh database, validate the Prisma schema,
  check migration status and schema drift, and repeat deployment without changes.
- Deploy the historical migration prefix through Prisma, then load an upgrade
  fixture containing integer gym users, a post, linked Google identities, and
  opaque database sessions. Deploy the remaining migrations and compare every
  original record, including IDs and relations.
- Run the upgrade fixture in a non-default PostgreSQL schema, checking both
  migration/runtime schema agreement and real NextAuth/plan HTTP responses.
- Reject plan mutations from incomplete legacy sessions, restart Next.js,
  and confirm the persisted public catalog is unchanged.
- Check the Google provider contract, persisted session identity and gym mapping,
  and CSRF-protected NextAuth sign-out followed by rejection of the revoked token.

Google callback checks use dummy credentials and controlled external transport:
local discovery/token/JWKS responses include signed ID tokens and enforce PKCE.
The real application still checks OAuth state and token signatures with the
installed NextAuth stack. Coverage includes first/repeated and concurrent Google
callbacks, durable verification and gym links, normalized collisions, existing
mapping preservation, audit-failure rollback, revoked roles, disabled Accounts,
safe status projections, client-session tampering, and enabled preview demos.

The reviewed cutover command is exercised against the same disposable database.
Upgrade checks report collisions, prove atomic failure preserves records, recover
through Prisma's migration ledger, and normalize historical email whitespace/case.
Ongoing environment overrides are replaced by persisted role assignments. See
[the Account cutover runbook](account-cutover.md). Live Google acceptance and the
later S01 profile/terms/MFA flows remain separate operational/implementation work.

## Reproducing tooling checks

The schema remains `backend/prisma/schema.prisma`; migrations remain beside it.
Both package manifests pin Prisma CLI, runtime, and `@prisma/adapter-pg` to 5.22.0.
The generated client is `backend/generated/prisma/client`, never committed to Git.
`npm ci` and `npm run build` generate it, and `npm run db:generate` regenerates it
explicitly. `backend/prisma/generated` was a stale, unused tracked output.

For a configured development database, run `npm run db:validate`,
`npm run db:status`, `npm run typecheck`, and `npm run build`. Use
`npm run db:migrate` to deploy committed migrations, or
`npm run db:migrate:dev -- --name <name>` to author a development migration.
All commands read the root Next.js environment configuration; backend generation
and migration scripts delegate to the same root wrapper.

For the optional Express scaffold, install its lockfile with
`npm --prefix backend ci`, then run `npm --prefix backend run typecheck` and
`npm --prefix backend run build`. Its server remains independent of S01 auth.
