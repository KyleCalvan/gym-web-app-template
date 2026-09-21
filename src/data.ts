import type {
  ActiveSession, Admin, AuditLogEntry, CurrentUser, DayDatum, LabeledDatum,
  Member, MonthDatum, Notification, Plan, Promotion, Role, Session,
  Staff, Transaction, Trainer,
} from './types.ts';

/* ===== Initial application data ===== */
export const INITIALS = (n: string): string =>
  n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

export const MEMBERS: Member[] = [];

export const TRAINERS: Trainer[] = [];

export const STAFF: Staff[] = [];

export const PLANS: Plan[] = [];

export const TRANSACTIONS: Transaction[] = [];

export const SESSIONS: Session[] = [
  {
    id: 'S-401',
    member: 'Juan Dela Cruz',
    trainer: 'James Reyes',
    date: '2026-08-20',
    time: '7:00 AM',
    type: 'Strength',
    status: 'Confirmed',
    paid: true,
    amount: 1200,
    rated: true,
    rating: 5,
  },
  {
    id: 'S-404',
    member: 'Angela Torres',
    trainer: 'James Reyes',
    date: '2026-08-21',
    time: '6:00 PM',
    type: 'Strength',
    status: 'Confirmed',
    paid: true,
    amount: 1200,
    rated: true,
    rating: 4.8,
  },
  {
    id: 'S-410',
    member: 'Marco Villanueva',
    trainer: 'James Reyes',
    date: '2026-08-24',
    time: '9:00 AM',
    type: 'Conditioning',
    status: 'Pending',
    paid: false,
    amount: 1200,
  },
  {
    id: 'S-415',
    member: 'Liza Mendoza',
    trainer: 'James Reyes',
    date: '2026-08-26',
    time: '5:00 PM',
    type: 'Mobility',
    status: 'Confirmed',
    paid: true,
    amount: 1500,
    rated: true,
    rating: 4.9,
  },
];

export const REVENUE_TREND: MonthDatum[] = [];

export const REVENUE_7D: DayDatum[] = [];

export const REVENUE_SOURCE: LabeledDatum[] = [];

export const MEMBERSHIP_DIST: LabeledDatum[] = [];

export const NOTIFICATIONS: Notification[] = [];

export const PROMOTIONS: Promotion[] = [
  {
    id: 'promo-1',
    title: 'New Member Starter Pack',
    discountType: 'Percentage',
    discount: '20',
    validFrom: '2026-08-01',
    validUntil: '2026-10-31',
    plan: 'Any',
    code: 'WELCOME20',
    maxRedemptions: 100,
    redemptions: 0,
    minSpend: 1500,
    status: 'Published',
    imageUrl: '/promo-1.jpg',
  },
  {
    id: 'promo-2',
    title: 'Bring-a-Friend Bundle',
    discountType: 'Bundle',
    discount: '2-for-1',
    validFrom: '2026-08-15',
    validUntil: '2026-09-30',
    plan: 'Pair Membership',
    code: 'BRINGAFRIEND',
    maxRedemptions: 50,
    redemptions: 0,
    minSpend: 0,
    status: 'Published',
    imageUrl: '/promo-2.jpg',
  },
  {
    id: 'promo-3',
    title: 'Student Strength Pass',
    discountType: 'Fixed',
    discount: '500',
    validFrom: '2026-08-01',
    validUntil: '2026-12-15',
    plan: 'Monthly Strength',
    code: 'STUDENT500',
    maxRedemptions: 200,
    redemptions: 0,
    minSpend: 0,
    status: 'Published',
    imageUrl: '/promo-3.jpg',
  },
  {
    id: 'promo-4',
    title: 'Personal Training Kickoff',
    discountType: 'Percentage',
    discount: '15',
    validFrom: '2026-08-20',
    validUntil: '2026-11-20',
    plan: 'PT Bundle',
    code: 'PT15',
    maxRedemptions: 40,
    redemptions: 0,
    minSpend: 2500,
    status: 'Published',
    imageUrl: '/promo-4.png',
  },
];

export const ADMINS: Admin[] = [];

export const SUPERADMINS: Admin[] = [
  { id: 'SD-1042', name: 'Juan Dela Cruz', email: 'juan.delacruz@mail.com', status: 'Active', createdAt: '2025-02-12', avatarUrl: '/avatar-sd.jpg' },
];

export const CURRENT: Record<Role, CurrentUser> = {
  admin:      { name: 'Admin',       role: 'Administrator',       initials: 'AD' },
  staff:      { name: 'Staff',       role: 'Front Desk Staff',    initials: 'ST' },
  trainer:    { name: 'James Reyes', role: 'TRAINER',              initials: 'JR' },
  member:     { name: 'Member',      role: 'Member',               initials: 'ME' },
  superadmin: { name: 'Super Admin', role: 'Super Administrator', initials: 'SA' },
};

export const SEED_AUDIT_LOG: AuditLogEntry[] = [];

export const SEED_SESSIONS: ActiveSession[] = [];

export const peso = (n: number): string => '₱' + Number(n).toLocaleString('en-PH');
