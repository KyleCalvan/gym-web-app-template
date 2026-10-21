# S01 account design

This document records the completed grill-with-docs interview for [S01](../project-plan.md). Q1-Q35 are agreed, the final consistency review found no remaining product decisions, and the user confirmed shared understanding in Q36 on 2026-10-21. This interview produces design documentation; implementation is separate work.

**Published implementation spec:** [GitHub issue #2 — S01: Sign in and establish a real, authorized account](https://github.com/KyleCalvan/gym-web-app-template/issues/2), labeled `ready-for-agent`. The spec synthesizes the confirmed design, 65 user stories, implementation decisions, testing decisions, and scope exclusions.

## Approved project context

The [approved project overview](../project-documents/01.project-overview.md), version 1.0, is the high-level product baseline. It confirms five operational roles and unauthenticated public browsing, and includes both member self-registration and staff/administrator-assisted registration. Walk-in customers need not register as members. The approximate one-month development target has no fixed completion date; detailed permissions and business rules remain to be defined.

For S01, assisted registration introduces an account-claim/invitation branch and a permission boundary for staff/admin provisioning. The overview does not replace the interview decisions already agreed, or approve proposals from an unanswered round.

## Agreed decisions

### Round 1

- Extend the existing Next.js `/api` backend, PostgreSQL database, and database sessions. See [ADR 0001](adr/0001-nextjs-api-ownership.md).
- Deliver both Google and email/password authentication in S01, including email verification and password recovery.
- Give one person one account across multiple assigned roles. A purchased membership is a separate entitlement; account creation grants no paid access. See the [glossary](../GLOSSARY.md).
- Serve one gym organization. Roles apply across that organization; independent gyms and organization-specific assignments are outside S01.

### Round 2

- Allow public registration. It grants only the member role, with ordinary member access gated by verified email ownership and completed onboarding, and no purchased membership. A verified Google email satisfies the email-ownership gate.
- Make database role assignments authoritative in S01. Environment configuration is limited to controlled first-superadmin bootstrap rather than ongoing overrides. Privileged assignments use explicit server-controlled operations; the management UI remains in S18.
- Require fresh authentication to the existing account and verified ownership of a new sign-in method before linking. Matching emails alone must not silently merge accounts.
- Use authenticator-app codes and single-use recovery codes for two-step verification; email remains for address verification and password recovery. See [ADR 0002](adr/0002-authenticator-two-step-verification.md).
- Require two-step verification for staff, trainer, admin, and superadmin operations across both Google and password sign-ins. Members may opt in. An account with a privileged role must complete enrollment before using privileged operations.
- Disabling an account blocks every assigned role and invalidates all sessions. Membership expiry removes purchased access but permits sign-in for renewal and history.
- Bar demo identities from real authenticated business APIs, including plan mutations. Keep explicitly enabled development/preview demos on sample data.

### Round 3

- Require full name, verified email, contact phone, and terms acceptance for both registration paths. Phone is contact information, not a verified identity factor. Defer emergency contacts, photos, and other profile details to S02.
- Persist accepted terms version and server time. Require renewed explicit acceptance when a new terms version is designated mandatory, for both Google and password accounts.
- Restrict sessions awaiting email verification, onboarding, required authenticator enrollment, or an enabled MFA challenge to explicit completion endpoints, limited account status, and logout. Enabled MFA protects every assigned interface.
- Recover Google-only accounts through Google. Adding a password requires deliberate fresh Google authentication and any required second step in security settings; reset links do not silently create a password.
- Revoke every session after password reset or change, require normal sign-in afterward, notify the owner, and preserve MFA requirements.
- Accept a single-use recovery code only alongside proof of the primary sign-in method. Loss of both authenticator and recovery codes requires audited operator-assisted recovery, with its approval procedure settled in round 4.
- Expire member-only sessions after seven days idle or thirty days absolute, and sessions on accounts holding any privileged role after thirty minutes idle or twelve hours absolute. Sensitive security changes require authentication within five minutes.
- Use one 15-128-character password policy across registration, password addition, changes, and resets. Permit spaces and password managers, reject commonly compromised passwords, and impose neither composition rules nor routine forced rotation.

### Round 4

- Staff/admins invite members to claim their own accounts rather than choosing passwords. Recipients verify ownership, choose a sign-in method, and personally accept terms. Existing account holders authenticate before linking the invited record. Member records without online accounts remain S02's responsibility.
- Staff may invite members; administrators may additionally provision staff/trainers; superadmins control administrator and superadmin assignments. Enforce these limits server-side. S01 supplies underlying commands and the invitation flow; full management screens remain in their planned slices.
- Bootstrap the first superadmin with an explicit operator command naming a verified account; refuse once a superadmin exists. Provide no public bootstrap endpoint or continuing environment override. Prevent concurrent removal, disablement, or demotion of the last enabled superadmin. Authenticator enrollment remains mandatory.
- Exceptional loss of both authenticator and recovery codes requires a designated gym representative's identity check, a deployment operator's approval, and proof of the existing primary sign-in method. Use a dedicated audited command that revokes sessions and old recovery codes and requires authenticator enrollment again; it cannot change email, roles, or passwords. Apply the same procedure to superadmins without reopening bootstrap.
- Preserve Google's NextAuth flow and introduce an application-owned database-session service for passwords. Both paths share session storage, cookie policy, revocation rules, and authorization gates; restricted sessions may exist before completion, but cannot access business operations. Prove compatibility with the installed NextAuth version in integration tests. See [ADR 0003](adr/0003-shared-database-session-service.md).
- Trim and lowercase account emails consistently, without provider-specific dot or plus-suffix equivalence. Enforce database uniqueness. Report migration collisions for explicit resolution rather than merging identities. Import existing privileged assignments through an explicit reviewed migration rather than ongoing environment rules.
- Support adding Google/password methods in S01; defer email changes and removal of linked methods. Account email remains read-only until a verified change flow exists.
- Use configurable SMTP delivery with durable PostgreSQL-backed mail jobs, retries, and a scheduled dispatcher; use a local mail catcher for development. Production acceptance requires a configured sender and verified invitation, verification, reset, and security-notification delivery.

### Round 5

- Use enabled/disabled account status, with verification, onboarding, terms, and MFA as separate access requirements. Completing onboarding never overrides disablement. Re-enabling requires fresh sign-in and grants no new roles or membership.
- For new password registrations, verify email before setting the password. Verification links expire after twenty-four hours, reset links after thirty minutes, and invitations after seventy-two hours. Links are single-use; replacements invalidate earlier links. Invitations can be cancelled, and acceptance rechecks the inviter's current authority. Duplicate registration cannot overwrite existing credentials.
- Activate authenticator enrollment only after a successful code, then show ten single-use recovery codes once. Use six-digit, thirty-second authenticator codes and reject replay. Authenticator replacement, recovery-code regeneration, and optional MFA disablement require fresh primary authentication plus the current authenticator or a recovery code. Privileged accounts cannot disable MFA. Factor changes revoke existing sessions.
- Persist abuse limits across instances. Start with five failed password attempts per account in fifteen minutes, additional IP limits, and temporary cooldowns. Challenges expire after five minutes or five failures. Enforce sixty seconds between email resends plus recipient/IP quotas. Public responses do not disclose account existence; failed attempts never permanently disable accounts.
- Revoke all sessions on role changes; ordinary logout revokes the current session. Apply authority changes on the next protected request. Background polling does not extend idle time. Clear account-specific browser state on logout or identity change and report logout failures accurately. Multiple-role users choose an interface; remembering it grants no permission.
- Audit account creation, verification, terms acceptance, invitations, authentication outcomes, recovery, role/status changes, bootstrap, and session revocation. Record server time, actor, action, target, result, and request ID. Persist successful changes with their event; record rejected security actions separately. Exclude passwords, tokens, authenticator secrets, recovery codes, and unnecessary personal details.
- S01 creates minimum durable identity and profile links. S02 owns complete member records and profile management. `/api/me` supplies the real account, assigned roles, profile references, and required next steps. Real accounts see loading, empty, or unavailable states for unfinished slices, never sample identities or fabricated paid membership.
- S01 is incomplete until both sign-in methods pass real database-backed integration checks: reload persistence, first Google signup, linking, restricted-session enforcement, cross-account isolation, concurrent token use, role/status revocation, expiry, logout, and demo isolation. Require migration collision checks, working email delivery, and compatible Prisma generation. Later management screens stay in their assigned slices.

## Source constraints discovered

- Installed NextAuth v4 credentials callbacks issue JWTs rather than database sessions. Adding its CredentialsProvider alone does not satisfy the agreed database-session design. Read-only source investigation supports the agreed shared application session service using adapter methods, shared `AuthSession` storage, and explicit cookie configuration; issuing compatible cookies from password endpoints remains application-owned integration requiring tests.
- The first Google signup currently creates an auth identity before a durable gym identity link is established. Verified Google email is checked but not consistently persisted as verified ownership.
- Email normalization differs between role/gym-user lookup and auth-user persistence. Existing identity collisions require a migration policy.
- There is no mail-delivery implementation or configured example. Current signup requires full name, email, phone, password, and terms, but registration is local state.
- Current terms use a UI acknowledgement without persisted version/time and claim continued use accepts updates. Google bypasses acknowledgement.
- The current session lifetime inherits rolling thirty-day NextAuth defaults, without a remember-me control.
- The generated Prisma client at the imported path is absent; the other generated client is stale. Root/backend Prisma tooling must be reconciled before implementation.

## Consolidated implementation boundaries

### Identity and access

Preserve the distinction between the string auth identity and integer gym identity, their unique link, and explicit role-profile references. Resolve identity once on the server and use IDs for subsequent ownership checks. Google signup must establish or safely reconcile the durable gym link before business access; do not depend on a second Google login. Record Google's verified-email evidence in the same canonical ownership state used by password registration.

Enforce one shared authorization gate on every business operation, including existing plan mutations. Its inputs are the persisted account status, assigned roles, verification/onboarding/terms requirements, session validity, and that specific session's MFA assurance. The chosen interface and client session projection are presentation only. Before completion, allow only the specific status/completion/security/logout operations required for that state; a recognized NextAuth identity session is not proof of business authorization.

Bootstrap and exceptional recovery are explicit operator commands with durable audit records. Bootstrap is unavailable after the first superadmin exists. Exceptional recovery requires the agreed independent approvals and primary sign-in proof, resets the second factor only, and forces reenrollment. A deployment operator alone must not turn this command into a general account-takeover mechanism. The operational runbook must describe the designated gym representative's identity check and how both approvals are recorded before production use.

### Session and security behavior

Store MFA completion and authentication age per session, never as an account-wide boolean that unlocks other browsers. Bind challenges and reauthentication to the initiating account/session and intended operation. Atomically consume tokens/codes and rotate session credentials when establishing stronger access. Database-backed authorization must reject revoked, disabled, expired, incomplete, wrong-account, and wrong-session requests even if a stale page remains open.

Sensitive operations include adding a sign-in method, password changes, factor changes, recovery-code regeneration, privileged assignments/status changes, bootstrap, and exceptional recovery. Apply the agreed fresh-authentication and MFA requirements where an authenticated actor exists; dedicated operator procedures supply their separately approved authority. Google-only accounts require fresh provider authentication rather than an app session alone for primary proof. Password reset remains a recovery-token operation and does not remove MFA.

Use the existing structured-error convention from the plan (`code`, `message`, optional `fieldErrors`, `requestId`) and consistent 401/403/404/409/400-or-422 responses. Permit limited `/api/me` status for a recognized restricted session without exposing business data or secrets. Cookie-authenticated mutations need origin/CSRF protection; rate limits and security outcomes must remain durable across processes.

### Delivery and migration prerequisites

Reconcile Prisma package versions, generated-client paths, and generation/migration commands before schema expansion. Preserve existing Google identities and ownership references; report normalized-email collisions for explicit resolution. Migrate existing environment-assigned privileged roles through an explicit reviewed operation. Existing sessions must pass the same persisted authorization gates as new sessions; legacy session state cannot stand in for missing verification, terms, onboarding, or MFA assurance.

Provide SMTP sender configuration, a scheduled dispatcher for the PostgreSQL mail outbox, durable retry behavior, and a local mail catcher. Do not log action-link secrets or claim successful production delivery from a queued job alone. Delivery acceptance must distinguish queueing, successful dispatch, and an end-to-end received message.

Host configuration, sender credentials, scheduled-job wiring, and collision resolution are implementation/deployment prerequisites, not evidence that production is ready. No production migration, real-user invitation, or recovery command is executed as part of this design interview.

### Acceptance matrix

| Boundary | Required evidence |
| --- | --- |
| New accounts | Email-first password signup and first Google signup each yield one durable identity/link, verified ownership, completed required onboarding/terms, and no paid membership. |
| Existing accounts | Adding a method requires fresh existing-account proof; matching email alone cannot merge or overwrite credentials. Google-only reset does not create a password. |
| Invitations | Staff/admin/superadmin provisioning limits are enforced; acceptance proves the recipient's authority, checks current inviter permissions, and handles cancellation, expiry, retries, and concurrent acceptance. |
| Partial sessions | Direct business requests fail before verification, onboarding, terms, required enrollment, or an enabled challenge is complete; another browser stays restricted after one browser succeeds. |
| MFA and recovery | Enrollment confirms a code; replay/reuse/wrong-session challenges fail; recovery codes are consumed atomically; resets retain MFA; exceptional recovery records both approvals and forces reenrollment. |
| Sessions and roles | Both Google and password tokens work with session lookup and sign-out; idle/absolute expiry and all-session revocation work on the next request; last-superadmin safeguards withstand races. |
| UI and ownership | Role switching never grants access, account changes clear caches, and real accounts never resolve to sample profiles or another user's data. |
| Demo isolation | Demo cookies cannot authorize real business APIs, including plan mutations. |
| Infrastructure | Prisma generation/migrations are compatible, normalized-email conflicts are reported, limits survive multiple instances, mail retries do not duplicate actions, and required messages are received. |
| Audit | Successful changes and their safe audit record commit together; rejected security actions are retained appropriately; secret material is absent. |

## Final review status

All interview questions Q1-Q35 have been answered affirmatively. The final source/document consistency check found no remaining product decisions, and the user explicitly confirmed shared understanding in Q36 on 2026-10-21. The interview is complete and the S01 design is confirmed. Operational runbooks, migrations, endpoints, UI integration, tests, and deployment configuration are deliverables of a separate implementation task, not completed work in this interview.
