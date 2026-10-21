# Canonical Account cutover (S01.02)

Google callbacks now establish the Account and integer gym identity, stable
Google subject link, verified-email evidence, member role/profile, and audit
events in one PostgreSQL transaction. Repeated callbacks preserve those IDs.
Creating an Account grants no purchased Membership. An email match alone never
claims an existing gym record or adds a sign-in method.
Conflicting callbacks return an Account-link review message and request ID, with
a durable `account.conflict` event; they never overwrite the established mapping.

## Reviewed deployment procedure

Use a backup and a staging rehearsal before a production cutover. These are
operator instructions; implementation and tests do not execute a live cutover.

1. Keep the old `ROLE_ASSIGNMENTS` and `ADMIN_EMAILS` available for the explicit
   import. Run `node scripts/account-cutover.mjs plan --output <private-file>`
   against the intended database. The command also works before the new schema
   migration. It writes a report even when collisions make it exit with code 2.
2. Review every normalized-email collision and identity-link conflict. The
   report identifies records by table and ID. Resolve these through a separately
   reviewed data correction based on evidence of ownership; never delete, merge,
   or attach identities just because their normalized emails match. Unresolved
   configured roles, unverified identities, and missing gym mappings block import.
   Re-run the plan with a new output filename after corrections.
3. Apply committed migrations using `npm run db:migrate`. The migration independently
   checks collisions before updating any email. A collision aborts its transaction
   and includes affected identifiers in PostgreSQL's error detail. Resolve a failed
   Prisma migration only after inspecting its ledger and confirming rollback;
   follow Prisma's normal `migrate resolve --rolled-back` procedure before retrying.
4. Review the plan's database/schema, exact Account/gym IDs, email addresses, and
   assigned roles. Explicit `ROLE_ASSIGNMENTS` entries retain their precedence
   over the `ADMIN_EMAILS` fallback. Malformed, duplicate-normalized, empty, or
   unknown role lists are rejected. Reports contain personal data: keep them private.
5. Run `node scripts/account-cutover.mjs apply --plan <private-file> --reviewed-by <operator-id>`.
   This rechecks the reviewed snapshot under database locks, refuses stale or
   modified plans, and commits assignments/profile references together with safe
   audit events. It never creates Accounts for absent addresses or changes existing
   identity mappings. A rejected command commits no assignments. Review a fresh
   plan if Account, provider, or role state changes before application.
6. Remove the old role environment settings. Runtime session and authorization
   decisions read persisted assignments by Account ID; environment values are
   ignored. The importer only adds reviewed existing assignments. Future role
   management, first-superadmin bootstrap, and provider addition use their dedicated
   S01 commands/flows, not this migration.

No blanket session deletion occurs during migration. Legacy sessions remain able
to view limited Account status and log out, but carry no inferred verification,
profile completion, terms acceptance, or authenticator assurance. Known Google
subjects may establish their Account through a verified Google callback while
preserving their existing integer mapping. An ambiguous/missing mapping requires
explicit operator resolution. Disabled Accounts cannot create new sessions, and
session lookup removes their stored sessions.

## Status and completion boundary

`GET /api/me` uses the real database session and returns a private, uncached
projection of the current Account, verification status, and required next steps.
Restricted responses omit Assigned Roles and profile references. No request can
choose another Account by ID or email. `/account` and the authenticated application
show this status and retry/sign-out controls without inventing a Membership or
matching the Account against sample records.

This slice records the minimum name, phone, terms, status, and verification fields.
It does not implement profile/terms submission or authenticator enrollment. Their
next steps are displayed honestly until those S01 slices land. Privileged access
remains restricted pending authenticator support. Real plan mutations require a
complete, database-authorized session; demo cookies cannot authorize them.

Audit events contain database server time, actor, action, target, outcome, and a
server-generated request ID, returned as `x-request-id` on authentication responses.
Successful Account/verification changes and events commit together. Rejections
are recorded after rollback. If audit storage itself fails, authentication fails
closed. Passwords, Google tokens, cookies, and arbitrary profile metadata are never
accepted by the writer.

## Verification

Run `npm run typecheck`, the focused file
`node --test tests/integration/application.test.mjs`, and finally `npm test`.
The integration harness controls Google's external discovery/token/JWKS transport
using a test-process preload, a local provider, signed ID tokens, and PKCE/state
checks. Production has no test-provider option. Prisma, NextAuth, sessions,
routes, transactions, and PostgreSQL remain real. No live Google account is used;
a configured provider-supported Google sign-in remains an operational acceptance
check before deployment.
