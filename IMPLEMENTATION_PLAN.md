# Prioritized Implementation Plan
## Frontend Redesign & Feature Completion

**Based on**: Spec 18 (Frontend Integration) & Spec 19 (Frontend Implementation & QA)
**Phase 1 Inspection**: Complete
**Date**: 2026-10-19

---

## Executive Summary

The codebase is a **Next.js 16 / React 19 / TypeScript 5.4** gym management dashboard with:
- ✅ **Complete**: Landing page, authentication (demo + NextAuth), role-based navigation, core admin/staff/trainer/member/superadmin views, shared component library, design token system
- ⚠️ **Partial**: Member bookings, real API integration (only 2 endpoints), form validation consistency, test coverage
- ❌ **Missing**: Real payment integration, complete Prisma schema, API client layer, Context-based state, automated testing

**Recommended approach**: Incremental refactor alongside feature completion — don't rewrite App.tsx monolith before delivering member-facing features.

---

## Phase 2: Design System Standardization (Week 1-2)

### Goal: Unified, documented component system with consistent variants

| Task | Description | Files | Effort |
|------|-------------|-------|--------|
| **2.1** | Create design token TypeScript export | `src/styles/tokens.ts` (new) | 0.5d |
| **2.2** | Standardize button variants & sizes | `components.css`, `primitives` | 1d |
| **2.3** | Unify card variants (default, tabbed, featured, plan) | `components.css`, `landing.css` | 1d |
| **2.4** | Standardize form field components | `Field`, `TextInput`, `Select`, `Switch` | 1d |
| **2.5** | Create modal size variants (sm, md, lg, xl, full) | `Modal.tsx`, `components.css` | 0.5d |
| **2.6** | Tab/navigation consistency (pill tabs, sidebar, topbar) | `Sidebar.tsx`, `Topbar.tsx`, `components.css` | 1d |
| **2.7** | Document component API in Storybook | `.storybook/`, `*.stories.tsx` | 2d |
| **2.8** | Add visual regression baseline | `playwright.config.ts`, `visual/` | 1d |

**Deliverable**: `DESIGN_SYSTEM.md` with component inventory, variant matrix, usage guidelines

---

## Phase 3: Landing Page & Responsive Layouts (Week 2)

### Goal: Validate current approach works; optional migration to standard responsive

| Task | Description | Files | Effort |
|------|-------------|-------|--------|
| **3.1** | Audit landing page at 320px, 375px, 768px, 1024px, 1440px | Browser testing | 0.5d |
| **3.2** | Verify text readability at all zoom levels | `landing.css` zoom logic | 0.5d |
| **3.3** | Test hamburger drawer on iOS Safari, Chrome Android | `LandingNav.tsx`, `landing.css` | 0.5d |
| **3.4** | **Optional**: Migrate to standard CSS Grid/Flex responsive | `landing.css`, `landing.tsx` | 3d (if needed) |
| **3.5** | Ensure CTA conversion elements visible above fold at 320px | `LandingHero.tsx`, `landing.css` | 0.5d |

**Decision Point**: If zoom approach causes issues → migrate. Otherwise document as approved pattern.

---

## Phase 4: Member-Facing Features (Week 3-6) — **HIGHEST BUSINESS VALUE**

### 4.1 Member Dashboard (Complete)
- ✅ Stats, quick actions, upcoming sessions, promotions carousel

### 4.2 Member Bookings — **NEW FEATURE** (Week 3-4)
| Subtask | Description | Backend Dependency |
|---------|-------------|-------------------|
| Calendar view | Month/week/day toggle, trainer availability | `/api/trainer-availability` GET |
| Session booking | Select trainer → time slot → confirm | `/api/sessions` POST |
| Booking management | Upcoming/cancelled/history tabs | `/api/sessions` GET/PATCH |
| Recurring bookings | Weekly repeat option | `/api/sessions` POST (batch) |
| Waitlist | Notify when slot opens | `/api/waitlist` (new) |

**Components to create**: `MemberCalendar.tsx`, `BookingModal.tsx`, `BookingList.tsx`
**Prisma models needed**: `Session` (extend), `TrainerAvailability`, `WaitlistEntry`

### 4.3 Member Promotions (Enhance) (Week 4)
| Subtask | Description |
|---------|-------------|
| Promotion detail view | Full promo card with image, terms, expiry |
| Redemption history | Track used codes, remaining redemptions |
| Share referral | Generate referral link/code |
| Push notification opt-in | Link to preferences tab |

### 4.4 Member Account Settings (Complete)
- ✅ Profile, Security (2FA), Preferences, Delete Account

### 4.5 Member Check-ins (Week 5)
| Subtask | Description | Backend Dependency |
|---------|-------------|-------------------|
| QR check-in | Camera scan / manual code entry | `/api/check-ins` POST |
| Check-in history | Calendar heatmap, streak counter | `/api/check-ins` GET |
| Guest passes | Track guest check-ins per plan | `/api/guest-passes` |

**Prisma models needed**: `CheckInRecord`, `GuestPass`

### 4.6 Member Progress Tracking (Week 5-6)
| Subtask | Description |
|---------|-------------|
| Weight/measurements log | Chart + table, photo uploads |
| Workout history | Linked to booked sessions |
| Goal setting | Target weight, session frequency |
| Trainer notes visibility | Read-only coach comments |

---

## Phase 5: Staff, Trainer, POS, Admin Interfaces (Week 5-8)

### 5.1 Staff POS — Enhance (Week 5)
| Subtask | Description | Backend Dependency |
|---------|-------------|-------------------|
| Real payment integration | Stripe/PayMongo webhook handler | `/api/payments` POST, webhook |
| Inventory tracking | Retail items, stock levels | `Product`, `Inventory` models |
| Shift reporting | Cash drawer reconciliation | `/api/shifts` |
| Refund processing | Partial/full refunds with audit | `/api/transactions` PATCH |

### 5.2 Staff Member Management (Week 5-6)
- ✅ Member list, detail, search
- **Add**: Bulk actions (freeze, extend, message), CSV export

### 5.3 Trainer Calendar & Availability (Week 6)
| Subtask | Description |
|---------|-------------|
| Drag-drop availability | Visual weekly grid editor |
| Recurring patterns | "Every Mon/Wed 6-8pm" |
| Blockout dates | Vacation, holidays, maintenance |
| Conflict detection | Overlapping sessions, double-booked |

### 5.4 Trainer Client Management (Week 6-7)
| Subtask | Description |
|---------|-------------|
| Client roster | Assigned members, progress overview |
| Session notes | Private trainer notes per session |
| Program templates | Reusable workout programs |
| Progress reports | PDF export for clients |

### 5.5 Admin Reports & Analytics (Week 7)
| Subtask | Description | Backend Dependency |
|---------|-------------|-------------------|
| Revenue dashboard | MRR, ARR, churn, LTV charts | `/api/reports/revenue` |
| Membership funnel | Trial → Active → Churned | `/api/reports/funnel` |
| Trainer utilization | Sessions/week, revenue/trainer | `/api/reports/trainers` |
| Facility usage | Peak hours, capacity alerts | `/api/reports/facility` |
| Export (CSV/PDF) | Scheduled email reports | `/api/reports/export` |

### 5.6 Admin User Management (Week 7-8)
- ✅ Users, Trash, Sessions, Backups
- **Add**: Role assignment UI, bulk invite, audit log filtering

---

## Phase 6: Frontend Validation & API Integration (Week 3-8, parallel)

### 6.1 API Client Layer (Week 3) — **FOUNDATIONAL**
```typescript
// src/lib/api.ts (new)
export const api = {
  gymPlans: {
    list: () => GET<Plan[]>('/api/gym-plans'),
    create: (plan) => POST<Plan>('/api/gym-plans', plan),
    update: (name, plan) => PATCH<Plan>('/api/gym-plans', { action: 'update', name, plan }),
    activate: (name) => PATCH<Plan>('/api/gym-plans', { action: 'activate', name }),
    deactivate: (name) => PATCH<Plan>('/api/gym-plans', { action: 'deactivate', name }),
  },
  members: { /* ... */ },
  sessions: { /* ... */ },
  promotions: { /* ... */ },
  transactions: { /* ... */ },
  checkIns: { /* ... */ },
};
```

### 6.2 Shared Validation Schemas (Week 3)
```typescript
// src/lib/validation.ts (new) — Zod schemas
export const memberProfileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[\d\s-]{10,}$/),
  emergency: z.string().optional(),
});

export const planChangeSchema = z.object({
  planId: z.string(),
  paymentMethod: z.enum(['GCash', 'Card', 'Cash']),
  promoCode: z.string().optional(),
});

export const promotionRedemptionSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
});
```

### 6.3 Form Library Migration (Week 4)
- Replace inline validation in `LoginPage.tsx`, `MemberProfile.tsx`, `MemberMembership.tsx`
- Use **React Hook Form** + **Zod resolver**
- Consistent error handling, dirty tracking, submit handling

### 6.4 API Route Implementation (Week 4-7)
| Route | Methods | Prisma Models | Priority |
|-------|---------|---------------|----------|
| `/api/members` | GET, POST, PATCH, DELETE | `Member` | HIGH |
| `/api/trainers` | GET, POST, PATCH | `Trainer` | HIGH |
| `/api/sessions` | GET, POST, PATCH | `Session`, `TrainerAvailability` | HIGH |
| `/api/promotions` | GET, POST, PATCH | `Promotion`, `PromotionRedemption` | HIGH |
| `/api/transactions` | GET, POST, PATCH | `Transaction` | HIGH |
| `/api/check-ins` | GET, POST | `CheckInRecord` | MEDIUM |
| `/api/reports/*` | GET | Aggregated queries | MEDIUM |
| `/api/payments` | POST, webhook | `Transaction` + provider | HIGH |

### 6.5 Error Boundaries & Loading States (Week 5)
- Add `ErrorBoundary` wrapper per view
- Standardize loading skeletons (Table, Card, Chart)
- Toast normalization: `toast.success()`, `toast.error()`, `toast.loading()`

### 6.6 Optimistic Updates Pattern (Week 5)
```typescript
// Standard pattern for all mutations
const mutate = async (optimisticUpdate, apiCall, rollback) => {
  setData(optimisticUpdate); // Immediate UI update
  try {
    await apiCall();
    addAudit('info', 'Action completed');
  } catch (error) {
    setData(rollback); // Revert on failure
    toast.error(error.message);
    addAudit('error', 'Action failed', error.message);
  }
};
```

---

## Phase 7: Testing & Regression (Week 7-10)

### 7.1 Unit Testing (Vitest) (Week 7)
| Target | Coverage Goal |
|--------|---------------|
| Validation schemas | 100% |
| Utility functions (`peso`, `fmt`, `comparePlans`) | 100% |
| Promotion eligibility logic | 90% |
| Plan comparison utilities | 90% |
| Custom hooks (`useToast`, `useAuth`) | 80% |

### 7.2 Component Testing (React Testing Library) (Week 8)
| Component | Scenarios |
|-----------|-----------|
| `TabbedCard` | Title, right actions, children render |
| `Modal` | Open/close, focus trap, escape key, wide variant |
| `Table` | Sort, pagination, empty state, renderRow |
| `Dropdown`/`Select` | Keyboard nav, filter, multi-select |
| `Field`/`TextInput` | Label, error, required, disabled |
| `Switch` | Toggle, disabled, controlled |
| `StatTile` | Variants (court, amber, steel), number formatting |
| `LoginPage` | Validation, demo login, OAuth flow mock |

### 7.3 E2E Testing (Playwright) (Week 9)
| Flow | Steps |
|------|-------|
| Member signup → login → dashboard | Register, verify email, sign in, view dashboard |
| Member plan change | Compare plans, select, payment simulation, confirm |
| Admin create plan | Navigate, fill form, activate, verify in member view |
| Staff POS sale | Search member, add plan, payment, receipt |
| Trainer availability | Set weekly pattern, book session, verify conflict |
| SuperAdmin session mgmt | View sessions, terminate other, verify logout |

### 7.4 Visual Regression (Week 9-10)
- Baseline: All role dashboards, landing page, login, modals
- Viewports: 320px, 768px, 1024px, 1440px
- Themes: Dark, Light
- CI: Run on every PR, fail on pixel diff > 0.1%

### 7.5 Accessibility Audit (Week 10)
- axe-core automated scan (target: 0 violations)
- Manual keyboard navigation test
- Screen reader test (NVDA, VoiceOver)
- Color contrast audit (WCAG AA)
- Focus order verification

### 7.6 Performance Baseline (Week 10)
| Metric | Target |
|--------|--------|
| LCP (Landing) | < 2.5s |
| LCP (Dashboard) | < 3s |
| TTI | < 3.5s |
| Bundle size (gzipped) | < 200KB |
| Lighthouse score | > 90 all categories |

---

## Dependency Graph

```
Phase 2 (Design System) ──┬──→ Phase 4 (Member Features)
                          ├──→ Phase 5 (Staff/Trainer/Admin)
                          └──→ Phase 6 (API/Validation)

Phase 6.1 (API Client) ───┬──→ Phase 4.2 (Bookings API)
                          ├──→ Phase 5.1 (POS Payments API)
                          └──→ Phase 6.4 (All API Routes)

Phase 6.2 (Validation) ───┬──→ Phase 4 (Forms)
                          ├──→ Phase 5 (Forms)
                          └──→ Phase 6.4 (API validation)

Phase 7 (Testing) ────────→ All phases (continuous)
```

---

## Resource Allocation Recommendation

| Role | Week 1-2 | Week 3-4 | Week 5-6 | Week 7-8 | Week 9-10 |
|------|----------|----------|----------|----------|-----------|
| **Frontend Lead** | Design System | API Client + Validation | Member Bookings | Staff/Trainer | Testing Lead |
| **Frontend Dev 1** | Design System | Member Bookings | Member Progress | Trainer Calendar | E2E Tests |
| **Frontend Dev 2** | Landing Audit | API Routes (Members/Sessions) | POS Payments | Admin Reports | Visual Regression |
| **Backend Dev** | Prisma Schema | API Routes (Core) | API Routes (Reports) | Webhooks | Perf/Load Test |

---

## Success Criteria by Phase

| Phase | Definition of Done |
|-------|-------------------|
| **2** | Storybook published, all primitives have documented variants, visual regression baseline committed |
| **3** | Landing page renders correctly at 5 viewports, no horizontal scroll, CTA visible |
| **4** | Member can book/cancel sessions, view history, check in, track progress — all wired to API |
| **5** | Staff can process real payments, trainer manages availability, admin views real analytics |
| **6** | All forms use React Hook Form + Zod, all mutations use API client, zero raw fetch in views |
| **7** | >80% unit coverage, 10 critical E2E flows passing, 0 a11y violations, Lighthouse >90 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **App.tsx refactor blocks features** | Defer Context migration; add API client & validation first |
| **API contracts change during development** | Define Zod schemas first → generate types → share via `src/lib/schemas.ts` |
| **Payment integration delays** | Keep simulation mode; add provider abstraction (`PaymentProvider` interface) |
| **Design system scope creep** | Time-box Phase 2 to 2 weeks; "good enough" baseline, iterate later |
| **Testing infrastructure delays** | Start Vitest config Week 1; add tests incrementally with each feature |

---

## Appendix: Specification Mapping

| Spec 18 Section | Implementation Phase |
|-----------------|---------------------|
| 18.1 API Integration Patterns | Phase 6.1, 6.4 |
| 18.2 Data Fetching & Caching | Phase 6.1 (add SWR/TanStack Query later) |
| 18.3 Form Validation & Submission | Phase 6.2, 6.3 |
| 18.4 Error Handling & Boundaries | Phase 6.5 |
| 18.5 Optimistic Updates | Phase 6.6 |
| 18.6 Real-time Updates | Future (WebSockets/SSE) |

| Spec 19 Phase | Implementation Phase |
|---------------|---------------------|
| Phase 2: Design System | Phase 2 |
| Phase 3: Landing Page | Phase 3 |
| Phase 4: Member Features | Phase 4 |
| Phase 5: Staff/Trainer/Admin | Phase 5 |
| Phase 6: Validation & API | Phase 6 |
| Phase 7: Testing & QA | Phase 7 |

---

*Plan derived from Phase 1 inspection of 150+ files across 25 directories. All estimates assume 1 frontend lead + 2 frontend devs + 1 backend dev.*