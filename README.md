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
