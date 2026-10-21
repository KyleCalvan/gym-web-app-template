# Backend implementation and frontend integration plan

This plan maps the existing VinAthletics frontend to deliverable backend slices. Each slice includes persistence, server rules, an API contract, frontend integration, and acceptance checks. Complete one usable flow at a time instead of building all database tables, then all endpoints, then connecting the UI.

Analysis date: 2026-10-21. Findings are based on source inspection, not a running deployment or a verified database connection. Proposed endpoints and models below are implementation targets, except those explicitly listed as existing.

## 1. Current implementation

The application uses Next.js App Router, React, TypeScript, NextAuth v4, Prisma, and PostgreSQL. The older Vite setup and file tree in the first part of `README.md` do not describe the current application. Role navigation happens mostly inside `src/App.tsx`, with view registries in each role's `index.ts`.

### Existing backend support to preserve

| Area | Existing implementation | Remaining work |
| --- | --- | --- |
| Google sign-in | `app/api/auth/[...nextauth]/route.ts`, `src/auth/options.ts`, and `src/auth/adapter.ts` use database sessions and verified Google email linking. | Create/load real gym profiles after authentication; enforce account status and ownership throughout new endpoints. |
| Identity persistence | `backend/prisma/schema.prisma` has integer-keyed `User`, separate `AuthUser`, `AuthAccount`, `AuthSession`, and `AuthVerificationToken` models. `AuthUser.gymUserId` links the two identity systems. | Add gym domain models without breaking this relationship. `Post` exists but has no corresponding gym feature. |
| Assigned roles | `src/auth/roles.ts` derives roles from server-only `ROLE_ASSIGNMENTS` and `ADMIN_EMAILS`. | Make role changes from user management durable and effective in authorization; preserve a controlled bootstrap path. |
| Plan catalog | `app/api/gym-plans/route.ts` supports public `GET`, authorized admin/superadmin `POST`, and `PATCH` update/activate/deactivate. `GymPlan` persists the catalog. | Stable identifiers, monetary types, audit events, purchase rules, and frontend error handling. Preserve the serialized active-plan-limit check, defaulting to four. |
| Demo login | `/api/demo-session` issues signed HTTP-only demo cookies under environment restrictions. | Keep demo identities isolated from production workflows. These accounts are not real member records. |
| Separate API scaffold | `backend/src/app.ts` contains Express middleware and `GET /api/health`. | No gym business endpoints are implemented there. Decide the API boundary before adding another authentication system. |

### Frontend feature inventory

| Audience | Features available in the UI | Current data/behavior | Slices |
| --- | --- | --- | --- |
| Public | Marketing sections, plan cards, published promotions, trainer cards, location/contact/hours, login/register entry points. | Plans can load from the API; other lists use app state or landing-only fallback data. Contact actions are telephone/email links. | S03, S06, S08, S14 |
| All signed-in roles | Profile menu, assigned-role switching, profile information/photo, security settings, notification preferences, notification inbox, page search, theme toggle. | Google/demo sessions are server-supported; profiles and preferences are mostly React state. Theme uses local storage. Password reset and two-step verification are simulations. Search filters navigation labels. | S01, S02, S15 |
| Member | Dashboard with membership validity, upcoming sessions, latest payment, offers, and booking shortcuts. | Derived from client arrays; several screens fall back to the first sample member. | S02, S04, S10, S16 |
| Member | Plan comparison, renewal, plan change, cancellation reason, student ID/document submission. | Local mutations; checkout simulates payment. Verification becomes locally pending with no review workflow. Cancellation immediately expires the member while claiming admin confirmation is pending. | S03–S06, S13 |
| Member | Multi-date coaching checkout, trainer rates, promotions, rescheduling/cancellation, completed-session ratings/comments. | Local bookings and sessions are duplicated; slot checks are client-only. Cancellation text promises a refund without processing one. | S09–S11 |
| Member | Check-in calendar/history, streaks, activity charts, session log, editable weight/height and calculated BMI. | Local history and profile fields. | S12 |
| Member | Payment history, preferred GCash/Cash method, invoice/receipt preview and print-to-PDF. | Transactions are local; simulated entries are excluded from member history. Preferred method is app-wide state. | S04, S05 |
| Member | Promotion browsing, code copying, redeemed discounts, offer modal at login. | Local promotion/redemption arrays; offer-seen state is stored per member/promotion in this browser. | S06 |
| Staff | Dashboard, member lookup/search/status filter, member registration and check-in, POS cart, member/walk-in selection, transaction history/documents, trainer schedules. | Mostly React state. POS simulates payment. “My Transactions” filters by date, not cashier. Schedule cells contain fabricated times. | S02, S07, S09, S12, S16 |
| Trainer | Dashboard, assigned sessions, completion/cancellation, schedule-change request, day/week/month calendar, availability CRUD, profile/specialty/bio/photo. | Sessions are local; assigned-session views need server ownership scoping. Availability uses browser local storage. Change requests only produce a toast/audit entry. | S02, S08–S11, S16 |
| Admin | Member registration/editing, renewal, freeze/unfreeze, removal to archive; plan management. | Members are local; plan management is already backed by an API. | S02–S05, S18 |
| Admin | Trainer/staff roster CRUD, trainer rates/certifications/status, staff job role/shift, session assignment, availability overview. | Local mutations; availability overview is read-only. | S08–S11 |
| Admin | Payment list, refund/void action, invoices/receipts, revenue charts, report filters, CSV/PDF export. | Refund changes a local status. Several charts use empty fixture series; report filters do not constrain the actual exported data. | S05, S16 |
| Admin | Promotion create/edit/delete, publish/unpublish, active/scheduled/expired/draft filters, redemption counts, image upload. | Local state and base64 image previews. | S06 |
| Member/trainer/admin | Gym links and generated QR codes; admin destination editor. | Config stored in this browser; member/trainer navigation ID `chat` opens QR links. | S14 |
| Admin/superadmin | Audit/activity explorer with search, role/action/category/date filters, detail view, and incremental display. | Shared client audit array, capped at 500 entries. Client redaction and visibility filters are presentation only. | S17 |
| Superadmin | Unified user creation/editing, user filters, role/password controls, archive search/restore/bulk restore/purge, active sessions and termination, backups/upload/restore. | User edits only change arrays; role fields do not update real assignments. Session termination does not revoke auth sessions. Backup download captures client state; upload/restore are simulations. | S18–S20 |

Unused components are not committed features: `src/shared/chat/ChatView.tsx` has message/attachment UI but is not mounted by the current member/trainer views. `FileManagerModal.tsx` is an unconnected placeholder. Do not build a messaging service or document-management product for these components unless they are brought into scope. Implement uploads needed by profiles, promotions, and student verification in their own slices.

## 2. Working assumptions and shared implementation rules

### API boundary

Agreed S01 direction: extend the existing same-origin Next.js `/api` routes, keep business services and persistence separate from route handlers, and use the existing PostgreSQL database and database sessions. See [ADR 0001](docs/adr/0001-nextjs-api-ownership.md) and the [shared-session decision](docs/adr/0003-shared-database-session-service.md). These are design decisions; implementation remains pending.

The separate Express scaffold does not own S01 authentication or authorization. Moving business endpoints there would require revisiting ADR 0001 and defining authenticated server-to-server identity or a shared session verifier. Express must not trust browser-supplied user IDs or roles. Give the two processes distinct ports if both are run; the Express scaffold currently defaults to 3000 too.

Read the installed Next.js guides before implementation: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `01-app/02-guides/backend-for-frontend.md`. Both were consulted for this plan. Align root/backend Prisma versions, generated-client paths, migration commands, and database configuration before expanding the schema; current generation/import locations need reconciliation.

### Contracts and identity

- Resolve the authenticated principal on the server. Use the `AuthUser` to `User` mapping and explicit role-profile IDs. Do not join records by display name or email after identity has been established.
- Keep integer gym user IDs and string auth IDs distinct. Introduce stable IDs for members, trainers, plans, orders, and bookings; display codes such as `M-1042` can be separate unique fields. Remove numeric-ID threshold filtering from member directories.
- Replace `members[0]`, `CURRENT[role]`, and synthetic Google/demo member fallbacks in real workflows with `/api/me` loading, onboarding, and missing-profile states. Registering an account must not silently grant a paid Premium/Basic membership.
- Return only role-authorized fields. Member endpoints scope to self, trainer endpoints to the assigned trainer, staff endpoints to their operational permissions, and administration endpoints to the appropriate assigned role. Choosing a UI role does not grant permission.
- Preserve the existing `/api/gym-plans` response while migrating consumers. For new APIs, use explicit resource responses, cursor pagination for large lists, and structured errors with `code`, `message`, optional `fieldErrors`, and `requestId`. Map unauthenticated/forbidden/missing/conflicting/invalid requests consistently to 401/403/404/409/400 or 422.
- Validate allowed input fields and business transitions on the server. Use origin/CSRF protection for cookie-authenticated mutations; rate-limit login, reset, verification, checkout, and upload operations. Do not expose secrets in responses or logs.

### Money, dates, and transactions

- Store PHP money as integer centavos or a fixed-precision decimal, never binary floating-point. Define rounding once. Existing frontend promotion helpers round to whole pesos; explicitly preserve or revise that behavior in server quotes.
- Store canonical timestamps in UTC and business dates in ISO format. Use one gym timezone, initially matching `BOOKING_TIME_ZONE` (`Asia/Manila` by default), for attendance, promotion dates, expiry, and reports. Do not use the developer machine's timezone as the business rule.
- Use server quotes/order lines containing price, discount, fee, currency, plan/trainer version, and expiration. Clients submit selections and quote/order IDs, never authoritative totals or `paid: true`.
- Keep payment state separate from booking/membership state. A paid coaching request can still await scheduling approval. Use database transactions and locks/constraints for competing purchases, redemptions, and slot allocations.
- Persist idempotency keys for checkout, cash confirmation, provider callbacks, refunds, and fulfilment. A retry must return the original result without another charge, renewal, booking, or receipt.
- Start a minimal append-only `AuditEvent` writer in S01 and record business events in each slice. Add the full explorer in S17. Publish durable notification/job events alongside successful mutations; dispatch and retry them outside the request as needed.

### Frontend migration pattern

For each slice: add its migration and server service, implement authorized endpoints, then replace the relevant `src/App.tsx` seed array/setter flows with typed query/mutation hooks. Return the committed server resource and refresh affected lists, summaries, documents, and notifications. Clear user-specific caches on logout or identity change. Show loading, empty, validation, conflict, retry, and permission states; keep forms open on failure and disable duplicate submission while pending.

Retain local state for forms, modal steps, navigation, charts derived from loaded data, and theme. Remove seed/browser data as the source of truth for migrated domain records. A failed catalog request must not leave sample plans silently purchasable. Test meaningful authorization, concurrency, and financial boundaries with a test database; frontend helper tests alone do not verify backend integration.

## 3. Vertical slices

### S01 — Sign in and establish a real, authorized account

**Outcome:** A user can sign up/sign in, refresh, select an assigned interface, recover access, and sign out with a durable identity.

**Frontend:** `src/LoginPage.tsx`, `src/App.tsx`, `src/auth/*`, `src/shared/components/SecurityFlow.tsx`, and `TwoFactorChallenge.tsx`.

**Implementation steps:**

1. Preserve Google OAuth and database sessions through a shared application session service. Add enabled/disabled account status, authoritative database role assignments, versioned terms acceptance, and a minimal append-only server audit writer. Bootstrap the first superadmin through a one-time operator command and protect the last enabled superadmin against concurrent removal, disablement, or demotion.
2. Implement email-first password registration, password sign-in, normalized unique email, password hashing, verified ownership, and explicit authenticated linking with existing OAuth accounts. Supply scoped invitation commands for assisted registration. Demo identities must not authorize real business APIs.
3. Add single-use expiring verification/reset/invitation tokens, durable SMTP delivery, password change, and session invalidation. Replace simulated email-code MFA and role-keyed local-storage flags with authenticator enrollment, per-session challenges, recovery codes, durable abuse limits, and server authorization gates. Required enrollment/challenges restrict access after both Google and password sign-in; recognized restricted identity sessions cannot access business operations. Implement the agreed fresh-authentication, factor-change, and operator-assisted recovery rules.
4. Connect sign-in/register/reset/security forms and role switching to server results and `GET /api/me`. Require full name, verified email, contact phone, and terms acceptance for both registration paths. Create minimal durable identity/profile links in S01, leaving complete profile management to S02. Show real loading/empty/unavailable states instead of sample identities or fabricated membership. Defer email changes and removal of linked methods.

**Proposed contracts/data:** Keep `/api/auth/*`; add registration, verification/reset, invitation, password-change, and authenticator/recovery endpoints plus `GET /api/me`. Extend the shared auth/session integration rather than registering conflicting auth routes. Add `UserRole`, credential/recovery/challenge, terms, audit, and mail-job records as needed. The [S01 design](docs/s01-account-design.md) supplies the agreed lifetimes, provisioning permissions, session limits, and acceptance matrix; concrete route schemas remain implementation work.

**Done when:** Both sign-in methods pass real database-backed integration checks for reload persistence, first Google signup, safe linking, restricted sessions, cross-account isolation, token/challenge concurrency, revocation, expiry, logout, and demo isolation. Client role/local-storage changes cannot grant access. Verify compatible Prisma generation, migration collision checks, and end-to-end email delivery. See the detailed [acceptance matrix](docs/s01-account-design.md#acceptance-matrix).

**Depends on:** Reconciled database/client configuration and implementation of the agreed shared-session integration. The API boundary decision is recorded in ADR 0001.

**Design interview:** Completed and confirmed by the user on 2026-10-21. [S01 account design](docs/s01-account-design.md) records the agreed answers to Q1-Q35 and final shared-understanding confirmation in Q36. One account supports assigned roles in one gym organization; purchased membership remains separate. The final consistency review is complete. Implementation is separate work and has not started as part of this interview.

**Implementation spec:** [GitHub issue #2](https://github.com/KyleCalvan/gym-web-app-template/issues/2), published with `ready-for-agent` after synthesis of the confirmed design and approved testing boundary.

### S02 — Create, find, and maintain member and self profiles

**Outcome:** Staff/admin registration and member/profile editing operate on the same persistent records.

**Frontend:** `AdminMembers.tsx`, `StaffMembers.tsx`, all five role profile components, `ProfileSettingsPanel.tsx`, and `src/App.tsx`.

**Implementation steps:**

1. Extend S01's minimal identity/profile links into a complete `MemberProfile` linked to the canonical user, with display member number, phone, emergency contact, joined date, and avatar asset reference. Keep role-specific profile details separate from account credentials and membership entitlements.
2. Implement member search/filter/detail/create/edit and self-profile endpoints. Staff get the operational fields needed for lookup; members cannot edit plan/status/roles through profile payloads. Admin plan edits must use S04 purchase/adjustment rules.
3. Map each role's profile to the signed-in identity. Complete trainer/staff profile details in S08, including fields currently missing from strict shared types such as trainer email/bio and member emergency contact.
4. Replace base64 avatar persistence with authenticated uploads and durable asset metadata. Validate actual file type/size server-side and connect all profile photo pickers. Keep this small upload service reusable for S06/S13.

**Proposed contracts/data:** `GET/POST /api/members`, `GET/PATCH /api/members/:id`, `GET/PATCH /api/me/profile`, and avatar upload/finalization endpoints; `MemberProfile`, `Asset`.

**Done when:** A staff-created member is visible to admin after reload; duplicate email is handled; another member's profile cannot be edited; avatar survives a new browser session; signup alone creates no paid entitlement.

**Depends on:** S01.

### S03 — Manage and publish the membership plan catalog

**Outcome:** Admin catalog changes consistently reach public cards, member comparison, and staff sales.

**Frontend:** `AdminPlans.tsx`, `MemberMembership.tsx`, `src/landing.tsx`, `landing/PlansStrip.tsx`, and `StaffPOS.tsx`.

**Implementation steps:**

1. Extend the existing `GymPlan` API and migration history. Introduce a stable plan ID and explicit billing duration without breaking the current name-based response; attach historical purchases to price/terms snapshots.
2. Preserve create/edit/activate/deactivate, admin/superadmin authorization, unique names, and the concurrency-safe active-plan limit. Audit every change. Deactivation prevents new sales while preserving existing memberships.
3. Reconcile monthly/quarterly/annual durations: the editor emits `mo/qtr/yr`, but `planDurationMonths` currently recognizes only annual versus one month. Resolve `Plan.members`: comparison calls it account capacity and seeds use 1/2, while new plans default it to zero. Keep subscription counts separate.
4. Serve a safe active public projection and an authorized management catalog. Replace silent marketing fallbacks for production catalog failures with honest loading/error/empty states. Comparison tables can remain client-rendered from server data.

**Contracts/data:** Preserve `GET/POST/PATCH /api/gym-plans`; add a public projection or explicit visibility parameter with server authorization. Evolve `GymPlan` and add version/snapshot support where needed.

**Done when:** Edits survive reload and appear across roles; concurrent activations cannot exceed the cap; quarterly purchases receive three months; inactive plans cannot be bought; historical prices do not change after editing/renaming a plan.

**Depends on:** S01; integrate with S04/S07 as they land.

### S04 — Purchase, renew, change, freeze, and cancel a membership

**Outcome:** Complete the first paid membership flow using authorized on-site cash confirmation; members can inspect real validity and access state.

**Frontend:** `MemberMembership.tsx`, `AdminMembers.tsx`, `MemberDashboard.tsx`, and member registration flows.

**Implementation steps:**

1. Add `Membership`, membership events, cancellation requests, and the minimal `Order`/`OrderLine`/`Payment` records for one cash purchase. Persist plan/price/term snapshots. Separate frozen/account state from expiry derived from dates.
2. Add server quotes, purchase/change/renewal requests, and staff/admin cash confirmation. Member-selected cash stays pending until received by an authorized cashier. Apply payment and membership fulfilment once in one database transaction.
3. Implement renewal from the later of valid expiry or the current business date, with calendar-safe month arithmetic. Define plan-switch timing/proration, freeze behavior, expiry/expiring thresholds, and cancellation effective dates before enabling those actions.
4. Implement admin freeze/unfreeze and cancellation request/review. Replace the current cancellation path that instantly expires the record and invents a zero-value refunded transaction. Any actual refund must use S05.
5. Connect member/admin renewal and dashboard validity to the same service. Add the missing cash-confirmation and cancellation-review UI needed to complete these workflows. Gate student plans until S13 is ready.

**Proposed contracts/data:** `GET /api/me/membership`, `POST /api/membership-quotes`, membership order/renewal/change/cancellation endpoints, `POST /api/payments/:id/confirm-cash`, and admin membership freeze/unfreeze/review commands.

**Done when:** Confirmed cash creates exactly one paid record and entitlement; member refresh shows correct expiry; failed/unconfirmed payment changes nothing; frozen/expired rules are enforced server-side; cancelling records the chosen policy and reason accurately.

**Depends on:** S01–S03. S05 adds electronic payment and real refunds; S13 unlocks student purchases.

### S05 — Pay electronically, inspect documents, and refund a payment

**Outcome:** Membership orders accept confirmed GCash payments, and financial history/refunds reflect real server state.

**Frontend:** `PaymentSimulationModal.tsx`, `src/payments.ts`, `MemberPayments.tsx`, `AdminPayments.tsx`, `StaffTransactions.tsx`, and `ReceiptDocument.tsx`.

**Implementation steps:**

1. Extend S04 payment records with attempts, provider references/events, refunds, cashier identity, receipt references, fees, and immutable line descriptions. Choose a provider supporting the required GCash flow; Card appears in shared types but is not a current checkout option.
2. Create provider sessions server-side from an unexpired quote/order. Validate webhook signatures, reference, currency, and amount; deduplicate and tolerate retries/out-of-order delivery. Only trusted confirmation fulfils an order. Support return-page status lookup and reconciliation of pending/missed events.
3. Implement admin refund/void requests and provider or recorded cash settlement. Track requested/processing/succeeded/failed separately and apply entitlement consequences explicitly. Never mark an order refunded because a browser clicked a button.
4. Add paginated, scoped history and immutable invoice/receipt data. A pending order can have an invoice; a paid receipt must reflect confirmed money. Preserve browser print-to-PDF unless a downloadable server PDF becomes a requirement.
5. Replace simulator callbacks in member/admin checkouts, connect history and document modals, and persist preferred method per account. Preserve separation of simulation and live payment data.

**Proposed contracts/data:** `POST /api/orders/:id/payment-attempts`, provider webhook, `GET /api/orders/:id`, scoped `GET /api/transactions`, transaction document endpoints, `POST /api/transactions/:id/refunds`, and payment-preference endpoint; `PaymentAttempt`, `ProviderEvent`, `Refund`, `Receipt`.

**Done when:** A forged success redirect cannot activate membership; duplicate callbacks do not duplicate fulfilment/receipts; failed refunds remain visibly failed/pending; history survives reload and excludes other members; documents retain the purchased price after catalog edits.

**Depends on:** S04.

### S06 — Publish an offer and redeem it in a real checkout

**Outcome:** Admin-created promotions appear to eligible members and produce an authoritative discounted order.

**Frontend:** `AdminPromotions.tsx`, `MemberPromotions.tsx`, `MemberPromotionModal.tsx`, promotion helpers, membership/booking checkout, and `landing/PromoStrip.tsx`.

**Implementation steps:**

1. Persist promotions, normalized unique codes, applicable plans, dates, status, percentage/fixed/bundle configuration, minimum spend, cap, and member redemption/claim records. Use the shared image upload service.
2. Implement admin CRUD and publish/unpublish plus public/member projections. Derive scheduled/active/expired buckets with gym business dates. Protect historical use when a promotion is removed.
3. Move eligibility, minimum-spend checks, and best-discount calculation into quote services. Clarify claim versus purchase consumption: the current UI increments the cap when unlocking a code and can invalidate already-unlocked offers when the cap is reached. Persist claims separately from order applications if preserving reusable unlocked offers.
4. Enforce one claim per member/promotion and cap allocation atomically. Preserve current single-best-offer behavior unless changed; only all-plan offers currently discount coaching, and bundle offers currently have no automatic monetary calculation.
5. Connect code entry, redeemed offers, savings labels, admin counts, landing cards, and login modal. Per-browser offer dismissal can remain local; add server seen state only if cross-device suppression is desired.

**Proposed contracts/data:** Admin promotion CRUD/publish endpoints, public/eligible promotion lists, `POST /api/me/promotion-claims`, and quote integration; `Promotion`, `PromotionClaim`, `OrderPromotionApplication`.

**Done when:** Draft/future/expired/wrong-plan/minimum-spend failures are handled; competing final-cap claims cannot both succeed; an abandoned checkout has defined cap behavior; the order total and receipt match the displayed discount.

**Depends on:** S02–S05. S10 reuses the same pricing rules.

### S07 — Complete a staff POS sale and find it in My Transactions

**Outcome:** A cashier can sell catalog items to a member or walk-in and retrieve their own sale and receipt.

**Frontend:** `StaffPOS.tsx`, `StaffTransactions.tsx`, and `StaffDashboard.tsx`.

**Implementation steps:**

1. Reuse order/quote/payment services. Record `cashierUserId`, customer identity or explicit walk-in details, source `POS`, and order lines. Validate current catalog prices and at most one membership plan per sale. Replace name-regex detection of training products with an explicit product kind if such products are actually introduced.
2. Link member purchases to S04 entitlement fulfilment. Define the walk-in membership policy: require creating/linking a member before granting membership, or leave entitlement pending claim; a walk-in receipt alone must not create an anonymous membership.
3. Integrate cash/GCash, prevent duplicate charges, preserve failed carts, and clear the cart only after confirmed success. Reuse promotion rules if POS discounts are enabled.
4. Query My Transactions by authenticated cashier and business date. Query staff summary data under explicit visibility rules instead of passing all transactions to every staff browser.

**Proposed contracts/data:** `POST /api/pos/quotes`, `POST /api/pos/orders`, existing payment commands, scoped transaction queries; extend S04/S05 order models.

**Done when:** A successful sale creates one receipt, cashier-linked transaction, and eligible membership update; another cashier's sales do not leak into My Transactions; unavailable plans and stale prices trigger a recoverable conflict.

**Depends on:** S02–S05; S06 if discounts are enabled.

### S08 — Maintain the workforce roster and trainer profiles

**Outcome:** Admin roster changes produce real trainer/staff profiles that their accounts and public cards can use.

**Frontend:** `AdminPeople.tsx`, `TrainerProfile.tsx`, `StaffProfile.tsx`, and `landing/TrainersStrip.tsx`.

**Implementation steps:**

1. Add `TrainerProfile` and `StaffProfile` linked to users. Persist specialty, certifications, session rate, bio/photo, employment status, job role, shift, hire date, and contact fields. Staff job roles such as Front Desk are distinct from the application role `staff`.
2. Implement admin create/edit/archive and invitation/account-linking workflows. Creating a roster record must result in a usable assigned profile without granting privileges through client form fields. Reuse S18's role-management service when available.
3. Add authorized roster/detail and self-profile APIs plus a limited public trainer projection. Derive ratings and session counts from persisted bookings/reviews instead of writable aggregate fields.
4. Connect forms and remove fabricated trainer fallbacks from the production landing page. S10 adds the session-assignment action currently present in AdminPeople.

**Proposed contracts/data:** `GET/POST /api/trainers`, `GET/PATCH /api/trainers/:id`, corresponding staff endpoints, and public trainer list; archive follows S18 rules.

**Done when:** A created trainer can sign in to their own profile, appears publicly only when eligible, and retains updated rates/details after reload; ordinary profiles cannot promote themselves to staff/admin.

**Depends on:** S01, S02. Uses the shared archive policy implemented fully in S18.

### S09 — Publish trainer availability and show real schedules

**Outcome:** A trainer's availability is visible consistently to trainer, admin, staff, and booking screens.

**Frontend:** `TrainerSchedule.tsx`, `trainer/availability.ts`, `AdminCoaching.tsx`, `StaffSchedules.tsx`, and member trainer cards.

**Implementation steps:**

1. Persist dated available/unavailable intervals by trainer ID. Define slot length, gym opening hours, no-schedule behavior, and whether any recurring schedule is required; current editable records are dated intervals.
2. Enforce own-trainer write access, valid future intervals, no prohibited overlaps, and compatibility with already allocated bookings. Use an allocation/locking approach shared with S10 so availability edits cannot race a booking.
3. Expose date-range schedules and available slot projections. Staff/admin may view permitted rosters; members receive only bookable slots and no other member details.
4. Replace `vinathletics.trainerAvailability` local storage and fabricated staff timetable cells with queries. Replace the hardcoded “Tomorrow, 7:00 AM” next-opening label with calculated availability.

**Proposed contracts/data:** Trainer availability list/create/update/delete endpoints and `GET /api/trainers/:id/slots?from=...&to=...`; `TrainerAvailability` and later shared slot allocations.

**Done when:** A trainer edit appears in another browser; conflicting/expired intervals fail server-side; neither a trainer nor a member can overwrite another trainer's schedule; changing availability cannot strand a live booking.

**Depends on:** S08. Recheck allocated bookings once S10 lands.

### S10 — Book and pay for one or multiple coaching dates

**Outcome:** Member dashboard and coaching checkout create the same durable, conflict-free bookings; admin can assign a session through the same rules.

**Frontend:** `BookingCheckoutModal.tsx`, `MemberCoaching.tsx`, `MemberDashboard.tsx`, and the assignment form in `AdminPeople.tsx`.

**Implementation steps:**

1. Add `Booking`, order-to-booking allocations, and expiring slot holds. Store member/trainer IDs, start/end timestamps, price allocation, scheduling status, and payment relationship. Make `bookings` and `sessions` two views of one canonical record.
2. Quote selected dates using real trainer availability/rates and permitted promotions. Validate active eligibility, future date/time, duration, repeated dates, trainer and member overlaps, and any confirmed entitlement limits.
3. Allocate all requested slots atomically or reject the group. Hold slots before starting payment, expire/release holds on failure, and confirm only from trusted payment/cash fulfilment. Define compensation for a late successful payment after hold expiry; never silently charge for unavailable sessions.
4. Distinguish scheduling approval (`Pending`/`Confirmed`) from payment. Provide admin assignment and any required confirmation action; an unpaid admin assignment must not set `paid` to true.
5. Replace both duplicated checkout persistence handlers with one mutation flow, show slot conflicts, and reload canonical bookings after success/reload. Display server totals and receipt references.

**Proposed contracts/data:** `POST /api/booking-quotes`, `POST /api/booking-orders`, `GET /api/me/bookings`, trainer/admin scoped booking lists, and admin assignment/confirmation commands; `Booking`, `SlotHold`, booking/order allocations.

**Done when:** Two clients competing for one slot cannot both book it; multi-date submission cannot partially charge/book accidentally; payment retries create no duplicates; trainer/member names can change without losing bookings; late payment has a visible recoverable outcome.

**Depends on:** S02, S04–S06, S08, S09.

### S11 — Reschedule, cancel, complete, and review coaching

**Outcome:** Everyone sees the same booking lifecycle, with real refunds and controlled schedule-change requests.

**Frontend:** `EditBookingModal.tsx`, `MemberCoaching.tsx`, `TrainerSessions.tsx`, `TrainerSchedule.tsx`, and admin operations views.

**Implementation steps:**

1. Implement an explicit transition policy for Pending/Confirmed/Cancelled/Completed bookings. Members act only on their bookings; trainers only on assigned bookings; admin actions use the same checks. Prevent stale concurrent updates with a version or lock.
2. Reschedule atomically against availability, overlap, cutoff, and price-change rules. Persist notes and cancellation reasons, release slot allocations, and connect eligible cancellations to S05 refunds by order-line allocation for multi-date purchases.
3. Persist trainer schedule-change requests with proposed date/time and reason. Add the missing admin review queue/approve/reject UI; approval applies normal reschedule checks and records the decision.
4. Permit one review per completed booking by its member, validate 1–5 stars, persist comment/time, and calculate trainer aggregates. Return updated booking and rating data to all affected views.

**Proposed contracts/data:** Booking reschedule/cancel/complete commands, schedule-change request create/list/decision endpoints, and `POST /api/bookings/:id/review`; `BookingEvent`, `ScheduleChangeRequest`, `TrainerReview`.

**Done when:** Another trainer cannot complete/cancel a session; terminal transitions cannot be replayed; cancellation refunds only the eligible allocation once; approved changes reach both parties; duplicate or premature reviews fail.

**Depends on:** S05, S09, S10. S15 delivers the durable notification events.

### S12 — Record attendance and maintain member progress

**Outcome:** Member self-check-in and front-desk check-in share one history, daily count, and activity calendar.

**Frontend:** `MemberActivity.tsx`, `StaffMembers.tsx`, `StaffDashboard.tsx`, and `src/App.tsx` check-in state.

**Implementation steps:**

1. Add `CheckIn` with member, server timestamp, gym business date, source, and acting user. For the initial policy, enforce at most one check-in per member/business date, matching the member UI; confirm this policy before replacing unrestricted staff increments.
2. Enforce membership eligibility, freeze/archive state, and agreed time/access restrictions. Decide whether self-check-in is intentionally allowed as shown; the UI alone does not prove physical presence.
3. Query shared attendance history/counts for calendar, streaks, weekly/monthly charts, and staff totals. Remove separate counter-only staff writes and use server business dates consistently.
4. Persist validated weight/height values under the member profile, or measurement history if historical progress is required. Calculate BMI for display from real values; remove default sample measurements and arbitrary fixed progress targets.

**Proposed contracts/data:** `POST /api/me/check-ins`, staff `POST /api/members/:id/check-ins`, scoped attendance queries, `GET/PATCH /api/me/measurements`; `CheckIn`, optional `MemberMeasurement`.

**Done when:** Simultaneous self/staff check-in creates one attendance record; both roles see the same count/history; frozen/expired rules are enforced at the API; date-boundary checks use the gym timezone; saved measurements survive reload.

**Depends on:** S02, S04.

### S13 — Submit and review student verification

**Outcome:** A student can submit documents, see a durable decision, and purchase an eligible student plan.

**Frontend:** Student document wizard in `MemberMembership.tsx`; add an admin review surface because none currently completes this flow.

**Implementation steps:**

1. Add verification requests, private document assets, submission/review timestamps, reviewer, reason, and expiry/reverification date. Persist explicit Submitted/Approved/Rejected/Expired states and map these to UI labels.
2. Implement authenticated upload/submission/status endpoints and admin review. Validate actual content/type/size server-side, restrict downloads to owner/reviewer, and define retention/deletion. Do not use public avatar-style URLs for ID documents.
3. Check approved, unexpired verification in the student-plan quote and fulfilment path, including renewal/reverification rules. A form preview or client status must not unlock a student plan.
4. Wire pending/rejected/resubmit/approved states into membership checkout and the admin queue; remove the local `verificationStatus` gate.

**Proposed contracts/data:** `GET/POST /api/me/student-verifications`, private upload/access endpoints, admin queue and review commands; `StudentVerification`, private `Asset` records.

**Done when:** A request survives reload; a member cannot self-approve or read another student's documents; approval unlocks the eligible purchase; expiry or rejection blocks it with a clear reason.

**Depends on:** S02–S04.

### S14 — Save official gym links and display QR codes everywhere

**Outcome:** An admin's verified destination updates member/trainer QR links across browsers.

**Frontend:** `AdminQrDestinations.tsx`, `GymQrLinks.tsx`, `src/qrDestinations.ts`, and member/trainer `Chat.tsx` wrappers.

**Implementation steps:**

1. Persist gym-scoped destinations with stable IDs, labels, URLs, and ordering. Implement admin-authorized updates and safe authenticated/public reads according to where links are displayed.
2. Apply existing HTTPS/public-host/no-embedded-credentials/Facebook-domain validation on the server, including at least one configured Facebook destination as currently required. Audit changes.
3. Replace `vinathletics.qrDestinations` browser persistence with server queries. Continue generating QR images in the frontend from saved URLs; no QR storage service is required.
4. Keep the public contact strip as configured location/hours/telephone/email content unless editable contact content is explicitly needed. There is no contact-message submission form to support.

**Proposed contracts/data:** `GET /api/gym-links`, admin destination update endpoint; `GymLink` or a small gym-settings record.

**Done when:** A second browser sees saved destinations; invalid or unauthorized updates fail; member/trainer QR codes encode exactly the saved URLs; an empty configuration shows an honest setup state.

**Depends on:** S01. Can ship early independently of financial work.

### S15 — Deliver account notifications and remember preferences

**Outcome:** Booking, membership, payment, and review events appear in the correct user's inbox and respect delivery preferences.

**Frontend:** `NotificationsDropdown.tsx`, `Topbar.tsx`, `ProfileMenu.tsx`, `ProfileSettingsPanel.tsx`, and role profiles.

**Implementation steps:**

1. Persist per-recipient notifications with created/read timestamps and a typed target, plus per-user email/SMS/reminder/promotion preferences. Remove the single shared app-wide notification/preference state.
2. Implement paginated inbox, unread count, mark-one-read, mark-all-read, and preference mutations. Restrict targets to views/resources the recipient can access.
3. Consume durable events from prior slices. Add idempotent reminder/expiry jobs, retries, and delivery records; do not duplicate reminders after rescheduling or job retry. Choose email/SMS adapters when enabling those channels.
4. Connect dropdown and settings controls, with polling or refresh initially. Cross-device live push is optional; persistence and correct delivery come first. Theme can remain a browser preference.

**Proposed contracts/data:** `GET /api/me/notifications`, read/read-all commands, `GET/PATCH /api/me/preferences`; `Notification`, `NotificationPreference`, event outbox and delivery/job records.

**Done when:** Read/preferences state survives logout/reload; another account cannot access the inbox; reminders use the final schedule and timezone; opted-out marketing is not delivered; job retries do not duplicate messages.

**Depends on:** S01, S02; connect each producer as S04–S13 ship.

### S16 — Show accurate dashboards and export filtered reports

**Outcome:** Role dashboards and report exports agree with persistent operational and financial records.

**Frontend:** All five dashboards, `AdminReports.tsx`, payment summaries, `MemberActivity.tsx`, and `shared/utils/csv.ts`.

**Implementation steps:**

1. Define each displayed metric precisely: gym-date sessions today, calendar MTD revenue/refunds, paid versus pending, source categories, new signups, expiring memberships, plan distribution, check-ins, trainer-specific ratings, and upcoming sessions. Include archived records only where historical reporting requires them.
2. Implement role-scoped aggregate/list queries with indexes on dates, status, user/trainer/cashier, and order source. Eliminate formatted-string date comparisons, missing `session.day` dependencies, and client sums over unbounded arrays.
3. Implement date/category report filtering once and share it with chart and export queries. Replace fixture series (`REVENUE_*`, `MEMBERSHIP_DIST`) and prevent simulated transactions entering live financial totals.
4. Generate authorized CSV data from the selected filters, escaping spreadsheet formula input. Keep print-to-PDF for loaded reports or add a background export/download endpoint if data size requires it. Staff/member responses must not include admin-only datasets.

**Proposed contracts/data:** Role-specific dashboard endpoints or `GET /api/dashboard`, `GET /api/reports/revenue`, and filtered export endpoint; derived read models rather than independently editable totals.

**Done when:** A cash sale, electronic payment, refund, cancellation, check-in, and role assignment produce the expected totals; month/timezone boundaries are correct; CSV and displayed filters return the same dataset; unauthorized exports fail.

**Depends on:** The slices producing each metric. Ship each dashboard projection alongside its first real workflow; finish the consolidated reports here.

### S17 — Explore durable activity and system audit events

**Outcome:** Admin and superadmin can investigate real changes with server-enforced visibility and pagination.

**Frontend:** `AdminActivity.tsx`, `SuperAdminSystemLogs.tsx`, and `shared/AuditLogExplorer.tsx`.

**Implementation steps:**

1. Extend the S01 audit writer with actor ID/role, server time, action, resource, result, request ID, safe metadata, and necessary before/after data. Persist successful business changes with their audit record; record denied/security events appropriately outside rolled-back transactions.
2. Implement indexed cursor queries with text/role/action/category/date filters and event detail. Define the admin-visible subset separately from superadmin system events on the server.
3. Redact sensitive material before persistence/response. Client regex redaction is not a confidentiality boundary. Provide no ordinary client mutation/deletion endpoint for audit records.
4. Replace in-memory `addAudit` as the authority and connect incremental loading/error/retry to real pagination. Preserve UI filtering/detail behavior while removing the 500-event memory cap as a retention policy.

**Proposed contracts/data:** `GET /api/audit-events`, `GET /api/audit-events/:id`; `AuditEvent` introduced in S01 and extended incrementally.

**Done when:** A reload retains events; browser-forged actor/time fields are ignored; admin cannot retrieve excluded superadmin events by direct request; pagination is stable and sensitive data is absent from API responses.

**Depends on:** S01; every earlier slice must already emit its required events.

### S18 — Manage users, roles, archive, and account removal

**Outcome:** Superadmin controls change real access, and removed records have a consistent restore/purge policy.

**Frontend:** `SuperAdminUsers.tsx`, `SuperAdminTrash.tsx`, admin member/people removal controls, and member self-delete in `MemberProfile.tsx`.

**Implementation steps:**

1. Build the unified user list from canonical identities and role profiles. Implement superadmin create/edit/role assignment/status/invitation commands using the database role authority established in S01. Environment configuration is limited to controlled first-superadmin bootstrap rather than ongoing role overrides.
2. Persist archive time/actor/reason. Apply archive filtering across lookup, booking, auth, and public projections, not only the UI. Archiving disables applicable access and revokes sessions while retaining financial/session references.
3. Implement single/bulk restore with bounded input and a defined atomic/result policy. Recheck uniqueness, roles/status, and entitlement validity; restoring must not silently renew an expired membership.
4. Implement purge and self-deletion under an explicit retention/anonymization policy. Resolve outstanding bookings, money/refunds, verification files, OAuth identity, and sessions; protect audit/accounting history and the last active superadmin.
5. Replace local role-change/reset-password controls. A password reset issues an expiring recovery/invitation flow rather than storing a surname as a password. Add reauthentication for sensitive operations and connect confirmations to committed server results.

**Proposed contracts/data:** Superadmin user list/create/edit/roles/status/reset-invitation endpoints, archive list/restore/bulk-restore/purge, and self-deletion command; extend `UserRole`, account/profile archive metadata, deletion request records if needed.

**Done when:** Role changes affect real authorization; archived users lose access; a bulk restore reports durable results; self-deletion logs the member out everywhere; financial records remain consistent; last-superadmin protections cannot be raced.

**Depends on:** S01, S02, S08; apply retention rules to S04/S05/S10/S13 records before purge is enabled.

### S19 — View and revoke real authentication sessions

**Outcome:** Superadmin session termination immediately prevents further authorized requests from that session.

**Frontend:** `SuperAdminSessions.tsx`, `SuperAdminDashboard.tsx`, and app login/logout state.

**Implementation steps:**

1. Use persistent auth sessions as the source, adding created/last-active/revoked metadata and safe device information where needed. Keep opaque display session IDs separate from secret session tokens; track activity with throttled server updates.
2. Implement superadmin list/revoke-one/revoke-all-others. Identify the current session server-side and preserve it when terminating others, including the same user's sessions on other devices.
3. Make logout, archive, password reset, and relevant role changes use the same revocation service. Already-revoked clients must fail on the next protected request and clear stale frontend state.
4. Remove fake `SESS-*` registration and local array deletion as evidence of access revocation. Separate demo sessions from live operational sessions.

**Proposed contracts/data:** `GET /api/admin/auth-sessions`, revoke-one and revoke-other commands; extend `AuthSession` metadata or add linked session activity records.

**Done when:** Revoked browser requests get 401 even if its page is still open; list updates survive reload; terminate-others preserves exactly the current session; tokens are never returned to the management UI.

**Depends on:** S01, S18 for unified account-governance integration.

### S20 — Create a restorable backup and complete a recovery drill

**Outcome:** The superadmin backup UI reports real durable backup/restore jobs instead of a client-state snapshot.

**Frontend:** `SuperAdminBackups.tsx` and superadmin overview.

**Implementation steps:**

1. Define backup scope, format/schema version, asset coverage, encryption/access, retention, and recovery targets. A browser JSON export is an application export; PostgreSQL recovery and private asset restoration need a consistent documented strategy.
2. Run backup/export in a worker or operational service with durable job status and protected artifact download. Include all introduced domain records, foreign keys, and asset references; never expose live session/OAuth credentials in ordinary application JSON exports.
3. Validate uploads server-side for size, version, schema, relationships, and integrity. Provide a validation/dry-run report before enabling restore. Uploaded arbitrary JSON must not be executed as a database restore.
4. Implement selected-backup restore jobs with recent superadmin authentication, explicit destructive confirmation, maintenance coordination, pre-restore recovery point, failure recovery, and subsequent session invalidation. Use a worker/operational tool rather than a long browser request.
5. Connect upload/download/restore controls to real artifact/job IDs and progress/errors. Test full restoration into an isolated environment, including assets and financial relationships, before enabling production restore.

**Proposed contracts/data:** Backup job create/list/status/download/upload/validate and restore-job endpoints; `BackupArtifact`, `BackupJob`, `RestoreJob`. Infrastructure/database backup mechanism is a separate implementation choice.

**Done when:** A backup exists outside one browser, validation rejects incompatible uploads, an isolated restore reproduces representative users/memberships/payments/bookings/assets, failure is recoverable, and job/audit history records the result.

**Depends on:** S17–S19 and the schema/assets being backed up. Establish infrastructure backups before the first production migration; this slice adds the user-facing maintenance workflow.

## 4. Suggested delivery order and dependency checkpoints

The slice numbers provide a default implementation order. S14 can ship directly after S01, S12 after S04, and S13 after S04; they do not need to wait for every lower-numbered slice.

| Milestone | Slices | Demonstration |
| --- | --- | --- |
| Identity and catalog | S01–S03 | Real accounts/profiles, authorized catalog editing, honest public data. |
| Membership and sales | S04–S07 | Register a member, confirm cash or GCash, renew/change membership, apply an offer, complete a cashier sale, retrieve documents/refund. |
| Training operations | S08–S11 | Create a trainer, publish availability, book multiple dates, confirm/reschedule/complete/cancel/review the same records across roles. |
| Member experience | S12–S15 | Shared attendance, private student verification with review, official QR links, persistent notifications/preferences. |
| Oversight and recovery | S16–S20 | Accurate reports, durable audit exploration, real role/archive/session controls, tested backup/restore. |

Introduce each slice's schema incrementally. Reuse shared `User`, profile IDs, order/payment records, assets, and audit events rather than creating parallel member/admin/staff versions of the same business record.

## 5. Decisions to settle before the affected slice

These checkpoints include unresolved choices discovered in the frontend and S01 decisions already settled in the design interview. Settled design decisions do not imply implemented policies.

| Decision | Evidence/gap | Needed by |
| --- | --- | --- |
| Next.js API or separate Express ownership | Settled: extend Next.js APIs and shared database sessions; see ADR 0001 and ADR 0003. | S01 implementation |
| Email credentials and two-step scope | Settled: Google plus email/password, explicit authenticated linking, authenticator/recovery codes, and required MFA for privileged accounts after either sign-in method; see S01 design. | S01 implementation |
| Paid access versus account creation | Settled: accounts, assigned roles, and purchased membership are separate; signup grants no paid access. Remove fabricated membership from real flows. | S01/S02/S04 implementation |
| Billing period, plan capacity, and entitlements | Quarterly duration is inconsistent; `members` has mixed semantics. Session limits, included PT, off-peak restrictions, two-person accounts, classes, dietary plans, and auto-renewal are shown in plan data but lack operational workflows. | S03/S04/S10/S12 |
| Auto-renewal | Catalog terms promise it, while the visible flow is manual renewal. Implement consent, recurring payment authorization, renewal jobs, and failures if retained; otherwise revise the terms. Do not infer recurring billing from a preferred method. | S04/S05 |
| Plan change, freeze, cancellation, and refunds | Full-price switches, immediate expiry, pending approval text, zero-value refund entries, and promised paid-session refunds do not form a consistent policy. Decide timing, proration, freeze expiry, cutoffs, and money consequences. | S04/S05/S11 |
| Promotion claims and use | Unlocking currently consumes the cap; discounts may be reused; bundle text has no calculation. Decide claim/use counts, one-use versus reusable offers, cap exhaustion, rounding, stacking, and abandoned checkout behavior. | S06 |
| Walk-in sales | POS permits an anonymous customer while selling membership plans. Decide how purchases become a real member entitlement. | S07 |
| Coaching approval and timing | Member payment creates a Pending booking; admin assignment is unpaid; explicit approval routing, duration, and cancellation deadlines are not established. | S09–S11 |
| Attendance policy | Member UI suggests once daily; staff increments have no deduplication/history. Decide eligible statuses, self-check-in, daily limit, and whether proof of presence is required. | S12 |
| Verification/review ownership | Student approval, membership cancellation review, cash confirmation, and trainer change-request decisions need added operational UI. Decide reviewers and required fields. | S04/S11/S13 |
| Role and deletion policy | S01 settles database role authority, provisioning permissions, and last-superadmin safeguards. S18 still needs restore effects, retention/anonymization, and deletion policy; self-delete currently removes immediately while admin removal archives. | S01 authority; S18 governance |
| Recovery scope and hosting | Existing backup is browser state, not a complete database/asset recovery mechanism. Decide operational hosting, job execution, artifact store, and recovery objectives. | Before production; S20 UI |

Plan labels/perks alone do not justify building class scheduling, family-account administration, dietary-plan management, or an internal chat service. Define whether to implement, enforce, or revise those advertised benefits before promising them in production.

## 6. Completion criteria and implementation workflow

For every slice, verify the happy path across its participating roles plus reload/new-session persistence, direct unauthorized requests, validation failures, and relevant concurrent/retried writes. Exercise actual server/database behavior for financial and booking boundaries. Keep existing tests in `tests/` as behavior references, especially promotion, plan comparison, booking dates, availability, payments, receipts, role assignments, and demo-session tests; resolve intentional behavior changes explicitly.

Run the applicable package's type checks/build and targeted integration tests as implementation proceeds. Check package scripts before relying on them: the root lint script is `next lint`, and this checkout has version-specific Next.js instructions. Verify migration and generated-client paths before deployment. Do not run production migrations, payments, purge, or restore as part of merely following this planning document.

Track implementation in GitHub Issues for `KyleCalvan/gym-web-app-template` per `docs/agents/issue-tracker.md`, using this file as the roadmap. Create a slice issue when scheduling it, include its dependencies and acceptance checks, and use the repository's five default triage labels. Unresolved decisions should stay `needs-info` or `needs-triage` rather than being marked ready. This analysis creates the requested local plan; it does not publish implementation tickets.

The backend integration is complete when every reachable workflow above has a durable server authority, each role sees only its permitted records, and the UI accurately distinguishes pending, confirmed, failed, cancelled, and refunded outcomes. Unused prototypes remain outside that completion definition.
