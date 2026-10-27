# Frontend database coverage

Reviewed October 27, 2026 against `src/types.ts`, the reachable role screens, and
`project-documents/02.frontend-user-stories.md`. This is a database foundation;
creating these tables does not connect the demo dashboards to persistent APIs.

The original schema had 10 models: User, Post, AuthUser, AuthAccount, AuthSession,
AuthVerificationToken, RoleProfile, AssignedRole, AuditEvent, and GymPlan. It was
enough for the existing account and plan APIs, but not the operational frontend.
The additive `20261027120000_gym_operations` migration adds 17 models and extends
existing models without deleting historical tables or rewriting migrations.

## Coverage by existing feature

| Frontend feature | Storage | Implementation notes |
| --- | --- | --- |
| Google account, assigned roles, account completion, logout | Existing AuthUser, AuthAccount, AuthSession, AssignedRole, RoleProfile | Account, gym role record, and purchased membership remain separate. |
| Password and two-step controls | AuthUser.passwordHash, AuthUser.mfaSecretEncrypted, AuthRecoveryCode; existing AuthVerificationToken | Storage only. Authenticator choice follows ADR 0002. Credential hashing, encryption/key management, token purpose/expiry/single-use handling, and recovery endpoints still need implementation. Never persist plaintext passwords, authenticator secrets, or recovery codes. |
| Member/trainer/staff directories and profile editing | User contact/photo fields, RoleProfile, MemberProfile, TrainerProfile, StaffProfile | Role-specific detail records reference the matching role through a composite foreign key. Admin/Super Admin contact details use User and RoleProfile directly. Staff job role differs from Assigned Role. |
| Member emergency contact, measurements, default payment | MemberProfile | BMI is calculated; fixed activity targets do not need tables. |
| Plans and comparison | Existing GymPlan | Keep current API types, including its Float catalog price and name primary key. New financial records use Decimal and snapshot descriptions/prices. Catalog member counts should eventually be derived from memberships rather than the existing demo count. |
| Purchased coverage, renewals, plan changes, freeze/cancel | Membership | Member-to-membership history with plan, validity dates, status, freeze/cancellation timestamps and reason. Each purchase/renewal can have its own record. No account creation grants purchased coverage. Cancellation timing and current-membership selection remain service rules. |
| Student document submission | StudentVerification | Private storage keys and Pending submission state. File upload/access control still needs implementation; no approval interface is added. |
| Staff POS, member/admin checkout, payment history, receipts | PaymentTransaction, TransactionItem | Nullable member supports walk-ins. Cashier identity supports cashier filtering. Keep references, fees, method, simulation flag, and immutable description/price snapshots. Amount is the discounted subtotal; fees are separate. Items sum to amount and item discounts sum to discountAmount; the checkout service must enforce these cross-row totals atomically. |
| Refund control | PaymentTransaction refundReason/refundedAt/status | Stores the recorded refund outcome; does not execute a GCash refund or define a separate void/partial-refund feature. |
| Availability, trainer discovery, coaching bookings and edits | TrainerProfile, TrainerAvailability, CoachingSession | Store actual instants, convert gym-local date/time at the boundary. Active bookings cannot share a trainer/start time. Availability overlap, availability enforcement, and entitlement checks still require transactional service validation. |
| Trainer schedule-change submission | ScheduleChangeRequest | Records the proposed time and reason only. No unestablished approval process is introduced. |
| Session completion and ratings | CoachingSession | One rating/comment per booking; database restricts ratings to completed sessions and values 1–5. Trainer averages and weekly totals are derived. |
| Staff/member check-in and activity | Attendance | One member check-in per gym-local business date. Both interfaces should write this same history. Frozen access checks remain service rules. |
| Promotion authoring, publishing, eligibility and redemption | Promotion, PromotionRedemption, TransactionItem | Null plan means Any Plan; codes are normalized uppercase and unique. One redemption per member/promotion matches the current frontend. Counts are derived. Cap enforcement and discount eligibility must be transactional; Bundle text is preserved without inventing discount arithmetic. Soft deletion preserves purchase/redemption history. |
| Notifications and preferences | Notification, NotificationPreference | Recipient-specific read state and preferences; not evidence of email/SMS delivery. |
| Gym QR destinations | GymQrDestination | Stores destinations and display order. Existing HTTPS/public-host validation remains required at the API boundary. |
| Archive, restore, permanent deletion | RoleProfile.archivedAt | Archive/restore changes the existing record, not a second copy. Service must reconcile access assignments when archiving. Referenced financial/attendance/booking records restrict hard deletion; an explicit retention/deletion policy is required before permanent deletion. |
| Dashboards, reports, charts, exports | Queries over the operational tables | No separate summary tables; apply date/role filters to records and export the same selection. |
| Activity/system logs | Extended AuditEvent | Supports severity, actor role, category, details, IP, metadata, and before/after data. The existing authentication audit writer remains restrictive; never put credentials or document contents into logs. |
| Active sessions | Existing AuthSession | Session termination must revoke real sessions; no parallel fake session table. |
| JSON snapshot download/restore | Operational tables plus AuditEvent | Last download can be an audit event. Snapshot validation/restoration still needs implementation; no backup scheduler or database-dump UI is introduced. |
| Public copy, appearance, navigation, promo dismissal | Existing frontend/browser state | These do not require new tables. Public plan, trainer, and offer displays can read their respective tables. |

## Compatibility and boundaries

- Existing User/Post and authentication data are preserved. Post remains a legacy
  scaffold table; its presence does not establish a blogging feature.
- Profile detail rows are optional until each flow is connected. Existing Google
  provisioning continues to create its Account, User, and member RoleProfile;
  member APIs must create the matching MemberProfile when connecting that flow.
- Plan renaming now updates the existing row so foreign keys cascade to related
  records. Purchased descriptions and prices remain unchanged.
- All new monetary amounts use `Decimal(12, 2)`. API adapters must serialize them
  deliberately to the frontend's number representation. No general product stock,
  walk-in pricing catalog, payroll, equipment, workout, chat, or approval tables
  are inferred from unreachable controls or marketing copy.
- SQL check constraints and the partial active-booking unique index live in the
  migration because Prisma 5 cannot express them all. Preserve them in subsequent
  migrations. Run `tests/integration/gym-schema.test.mjs` to exercise them.
- `migrate deploy` creates storage, not seed users or memberships. Never populate
  real accounts from demo login credentials.
- Tables have row-level security enabled with no public policies, including the
  migration ledger. Next.js connects as the table owner (or a dedicated server
  role with BYPASSRLS); direct Supabase API roles must not bypass app authorization.
  A restricted non-owner server role will need an explicit access design before
  use. See [Supabase's RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Environment used for this setup

The new database was configured in the root `.env.test`. Its full connection
string was under `DATABASE_CONNECTION_STRING`; it is now under `DATABASE_URL`,
as Prisma expects. Credentials remain in this ignored file.

Normal `npm run dev` and `npm run db:migrate` use development environment loading,
not `.env.test`. The same database connection is now configured in the root
`.env.local` for daily development; other environment settings were preserved.
The automated integration suite continues to use disposable PostgreSQL and does
not use this hosted database.

## Applied and verified

All six migrations were applied to the verified empty hosted database on October
27, 2026. It contains 27 application tables plus `_prisma_migrations`, all with
row-level security enabled. Migration status is up to date and Prisma's database
comparison reports no schema difference.

Validation passed: root and backend TypeScript checks, 44 unit tests, 24 existing
application integration tests (including migration upgrades), and 9 new schema
test results covering relationships, history, constraints, and default-deny RLS.
