# VinAthletics Gym — Management System

A role-based gym management dashboard (Admin / Staff / Trainer / Member) built with React + Vite.

## Getting started

This project was authored outside of a network-connected sandbox, so dependencies
have not been installed here. To run it locally:

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

To build for production:

```bash
npm run build
npm run preview
```

## Structure

```
src/
  main.jsx            Entry point
  App.jsx              Shell: routing between roles/views, notification modal
  Landing.jsx           Public marketing + role-based login/register
  Sidebar.jsx            Nav sidebar w/ smart search + multi-select filters (admin/staff)
  components.jsx          Shared UI primitives (Card, Table, Modal, Charts, StepTrack…)
  data.js                  Mock data (members, trainers, plans, transactions, promos…)
  styles.css                Design system ("Athletic Ledger")
  views/
    admin.jsx               Admin dashboard, members, plans, payments, reports,
                             trainers, Promotional Management module, activity, coaching
    staff.jsx                Staff dashboard, members, POS, transactions, trainer schedules
    trainer.jsx                Trainer dashboard, sessions, schedule, profile
    member.jsx                  Member dashboard, membership, coaching (with full
                                 booking checkout flow), payments, profile, and the
                                 Notifications overlay modal
```

## Recent changes

- **Admin**: added a full Promotional Management module (create/edit, active
  promotions table, publish/unpublish) plus a Dashboard summary widget; sidebar
  now has a smart search box + multi-select section filters.
- **Staff**: removed the redundant Quick Actions panel, the Available Plans
  overview, the revenue stat tile, and the Specialty column from trainer
  schedules; sidebar also gained smart search + filters.
- **Member**: the receipt preview is now an overlay modal; session booking is a
  full multi-step checkout (slot → payment → confirmation) that actually
  processes a mock payment; the old "Cancel" button on bookings is now "Edit",
  opening a modal with tabbed "Modify Booking" / "Cancel Booking" options; the
  whole notification settings + inbox experience is now a single overlay modal
  instead of a full page.
- Rebranded from FitPro to **VinAthletics**.

## Google OAuth setup

1. Copy the root `.env.example` to `.env.local` and set `DATABASE_URL`, `NEXTAUTH_URL`, and a strong `NEXTAUTH_SECRET` (for example, generate one with `openssl rand -base64 32`). Local env files are Git-ignored.
2. Create a Google OAuth **Web application** client in Google Cloud Console. Add these authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://<your-domain>/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`. The login screen detects provider availability from the server-side Auth.js providers endpoint; the client secret is never exposed.
4. Set `ADMIN_EMAILS` to a comma-separated list of verified Google account emails permitted to manage membership plans. Set `ACTIVE_PLAN_LIMIT` to the maximum number of active plans (defaults to `4`).
5. Optionally set `ROLE_ASSIGNMENTS` as a server-only JSON object mapping verified Google account emails to explicitly assigned role arrays, for example `{"coach@example.com":["member","trainer"],"manager@example.com":["member","admin","staff"]}`. Explicit assignments override the default member role and `ADMIN_EMAILS` fallback for those accounts. The profile menu only offers roles returned by the server-authenticated session.
6. Apply the additive Auth.js and membership-plan tables to the same Postgres database with `npm run db:migrate`, then run `npm run build` and `npm run start`.

The Google callback verifies Google's `email_verified` claim. A verified email matching an existing gym `User` is linked to that record; otherwise a gym user is created. Auth.js keeps its OAuth identities and sessions in separate tables, preserving the existing integer user IDs and `Post` relation. It does not enable dangerous email-only linking between OAuth providers. All Google sign-ins default to the member role unless an explicit server-side assignment exists; an address in `ADMIN_EMAILS` receives member and admin roles unless overridden by `ROLE_ASSIGNMENTS`. The client cannot add roles by selecting an interface. Membership-plan mutations require an authenticated session carrying an assigned admin or superadmin role. The initial plan catalog is copied into the new plan table on its first API read if that table is empty.

During local development, the role selector offers these server-validated demo accounts: `member@vinathletics.gym` / `member123`, `staff@vinathletics.gym` / `staff123`, `trainer@vinathletics.gym` / `trainer123`, `admin@vinathletics.gym` / `admin123`, and `superadmin@vinathletics.gym` / `superadmin123`. Demo sessions are signed and stored in an HTTP-only cookie; they use `DEMO_SESSION_SECRET` or `NEXTAUTH_SECRET` when configured, with a local-development-only fallback otherwise. Demo login is disabled automatically when `NODE_ENV=production`, and can be disabled in other environments with `DEMO_ACCOUNTS_ENABLED=false`. These are sample accounts for local development only and must never be treated as real user identities. Other screens and mutations that still operate only on in-memory demo state are not production backend workflows; any future persistent or sensitive action must be moved behind an authenticated server endpoint with the matching role check and durable audit logging.
