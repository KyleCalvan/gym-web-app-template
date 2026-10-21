# Shared database sessions

Google retains NextAuth v4's database adapter flow. `src/auth/sessions.ts`
owns the same opaque-session storage used directly by subsequent password
and security services. JWT conversion and private NextAuth patches are not
used. The Express scaffold does not participate.

Configure `NEXTAUTH_URL` to the canonical application origin and
`NEXTAUTH_SECRET` to a durable secret. HTTP uses `next-auth.session-token`;
HTTPS uses `__Secure-next-auth.session-token`. Both are host-only, HttpOnly,
SameSite=Lax, and scoped to `/`. Request or forwarded headers never downgrade
cookie security. Application-issued tokens contain 32 random bytes.

`createSession(tx, { accountId })` is for a caller that has just verified the
primary method. Commit it with that authentication transition and its audit.
`setSessionCookie(response, session)` issues the compatible cookie after
commit. Google uses this service through the official adapter's public methods.

`readSession(token)` performs a passive lookup. NextAuth polling, `/api/me`,
client session updates, and server-rendered Account status never update idle
time. An authorized business request through `withBusinessAuthorization`
updates idle time in the business transaction. Member-only Accounts expire
at seven idle days or thirty absolute days. Holding any privileged Assigned
Role changes those limits to thirty idle minutes and twelve absolute hours.
Equality at either deadline is expired. Limits are re-evaluated from current
persisted roles; polling and rotation cannot renew absolute age.

The migration preserves existing tokens, starts their previously unknown age
at cutover in UTC, preserves any earlier stored expiry, and grants no fresh
authentication or MFA evidence. Existing Accounts must satisfy all current
requirements. This is not a blanket logout migration. Apply it using the
normal reviewed database migration procedure; implementation does not run it
against a live database.

Every business route must use the shared gate with its required Assigned
Roles. The gate checks the current Account, verified email, established gym
identity, name and phone, the current mandatory terms version, valid role
profile mappings, session validity, required enrollment, and session-specific
MFA assurance. `CURRENT_TERMS_VERSION` in `account.ts` is the release policy;
changing it requires renewed acceptance rather than rewriting stored acceptance.
Public plan browsing remains public. Restricted sessions can read their own
limited status and log out; future completion/security routes must explicitly
check their own allowed state and operation. No general bypass exists.

Authenticator completion is supplied by a later slice. Until then privileged
Accounts cannot gain business access. `mfaEnabledAt` records confirmed
enrollment; an individual session's `mfaVerifiedAt` must refer to that enrollment
or a later proof. Member-only Accounts with enrollment are also restricted
until that session proves MFA. Account-level enrollment never authorizes a
different browser.

Security callers use `rotateSession(tx, ...)` after verifying the relevant
primary or second-factor proof. It checks Account ownership, consumes the old
credential, preserves absolute age, and records proof only on the rotated
session. Never pass browser-supplied proof flags. Consume action/session-bound
challenges atomically in the caller's transaction. `hasFreshAuthentication`
only checks the primary-proof timestamp against the strict five-minute window;
it does not replace the caller's action binding or required second-step check.

Password resets/changes, role/factor changes, and disablement must call
`revokeAccountSessions(tx, accountId)` in the same transaction as the change.
Issuance, lookup, rotation, and revocation serialize on the Account row before
the session row. Re-enablement requires a new sign-in after revocation.

Cookie-authenticated plan mutations require the configured exact Origin.
Missing, opaque, or foreign origins fail closed; client roles and demo cookies
never authorize persistence. Rejections have `code`, `message`, and `requestId`
with a matching `X-Request-Id` header. Business authorization/storage failures
return 503 without committing the business write.

`POST /api/auth/signout` retains the installed NextAuth CSRF/form contract
and also accepts same-origin JSON from the Account UI. Foreign origins are
rejected even with valid CSRF material. It revokes only the requesting session,
commits its audit, then clears local, secure, and legacy chunk cookies. Requests
with stale chunk cookies still revoke the explicit base credential; valid
chunks-only credentials can also be revoked. Malformed chunks are rejected.
Storage failures return 503 and retain cookies for retry. This application-owned route wrapper
avoids v4's default behavior of swallowing adapter sign-out failures. GET
sign-out pages and Google's route family remain with NextAuth. Successful form
posts redirect; JSON callers receive a same-origin callback URL.

Security audits contain fixed actions, outcomes, Account identifiers, server
time and request IDs. They never store tokens, passwords, provider claims,
authenticator secrets, or recovery material. Successful revocations/rotation
and their audits commit atomically; failed/rejected outcomes are recorded
outside rolled-back transactions where storage permits.

Run `npm test` for isolated PostgreSQL and HTTP coverage. The harness controls
Google transport and the child process clock at external boundaries. A temporary
test-only route drives trusted service callers during the integration build;
its source is removed in `finally` and it is absent from ordinary builds. It
does not implement password authentication or authenticator verification. Tests
cover the installed NextAuth version and must be rerun when upgrading it.
