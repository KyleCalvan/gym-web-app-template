import type {
  ActiveSession, Admin, AuditLogEntry, CurrentUser, DayDatum, LabeledDatum,
  Member, MonthDatum, Notification, Plan, Promotion, Role, Session,
  Staff, Transaction, Trainer,
} from './types.ts';

/* ===== Initial application data ===== */
export const INITIALS = (n: string): string =>
  n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

/* Short, badge-friendly name for each role. CURRENT[role].role is the verbose
   job title ("Front Desk Staff", "Super Administrator") — too wide for a mobile
   header chip, so the compact surfaces use this instead. */
export const ROLE_LABEL: Record<Role, string> = {
  member: 'Member',
  staff: 'Staff',
  trainer: 'Trainer',
  admin: 'Admin',
  superadmin: 'Super Admin',
};

export const MEMBERS: Member[] = [
  { id: 'M-1001', name: 'Maria Santos', email: 'maria.santos@mail.com', phone: '+63 917 123 4567', plan: 'Premium', status: 'Active', joined: '2026-01-15', avatarUrl: '/avatar-m1.jpg' },
  { id: 'M-1002', name: 'Ricardo Gomez', email: 'ricardo.gomez@mail.com', phone: '+63 918 234 5678', plan: 'Elite', status: 'Active', joined: '2026-02-10', avatarUrl: '/avatar-m2.jpg' },
  { id: 'M-1003', name: 'Elena Cruz', email: 'elena.cruz@mail.com', phone: '+63 919 345 6789', plan: 'Basic', status: 'Expiring', joined: '2026-03-05', avatarUrl: '/avatar-m3.jpg' },
  { id: 'M-1004', name: 'Antonio Luna', email: 'antonio.luna@mail.com', phone: '+63 920 456 7890', plan: 'Premium', status: 'Frozen', joined: '2026-04-20', avatarUrl: '/avatar-m4.jpg' },
];

export const TRAINERS: Trainer[] = [];

export const STAFF: Staff[] = [];

export const PLANS: Plan[] = [
  {
    name: 'Basic',
    price: 1200,
    period: 'mo',
    members: 1,
    perks: ['Gym Access', 'Locker Use', 'Standard Equipment'],
    featured: false,
    status: 'Active',
    category: 'Standard',
    description: 'Everything you need to get started on the main gym floor.',
    restrictions: ['No group classes', 'Off-peak access only (6 AM–4 PM)'],
    sessionLimit: 4,
    facilities: ['Main floor', 'Locker rooms'],
    includedBenefits: ['Gym Access', 'Locker Use', 'Standard Equipment'],
    excludedBenefits: ['Group Classes', 'Personal Training', 'PT Studio Access', 'VIP Lounge'],
    terms: 'Auto-renews monthly. Cancel anytime from your membership page.',
  },
  {
    name: 'Premium',
    price: 2499,
    period: 'mo',
    members: 1,
    perks: ['Unlimited Access', 'Group Classes', 'Free Towels'],
    featured: true,
    status: 'Active',
    category: 'Standard',
    description: 'Full-day access with classes and standard recovery amenities.',
    restrictions: ['Standard amenities only — PT studio and VIP lounge excluded'],
    sessionLimit: 8,
    facilities: ['Main floor', 'Group studio', 'Locker rooms'],
    includedBenefits: ['Unlimited Access', 'Group Classes', 'Free Towels', 'Standard Equipment'],
    excludedBenefits: ['Personal Training', 'PT Studio Access', 'VIP Lounge', 'Dietary Plan'],
    terms: 'Auto-renews monthly. Cancel anytime from your membership page.',
  },
  {
    name: 'Elite',
    price: 4500,
    period: 'mo',
    members: 2,
    perks: ['All Premium Perks', '1 PT Session/mo', 'Dietary Plan', 'VIP Lounge'],
    featured: false,
    status: 'Active',
    category: 'Standard',
    description: 'Premium plus a personal training session, dietary plan, and VIP access.',
    restrictions: ['Up to 2 members on the account. Dietary plan valid for 30 days from issue.'],
    sessionLimit: 'unlimited',
    facilities: ['Main floor', 'Group studio', 'PT studio', 'VIP lounge', 'Locker rooms'],
    includedBenefits: [
      'Unlimited Access',
      'Group Classes',
      '1 PT Session / month',
      'Dietary Plan',
      'VIP Lounge',
      'Free Towels',
      'Standard Equipment',
    ],
    excludedBenefits: ['Additional PT sessions beyond 1 / month'],
    terms: 'Auto-renews monthly. Cancel anytime from your membership page.',
  },
  {
    name: 'Student Plan',
    price: 800,
    period: 'mo',
    members: 1,
    perks: ['Gym Access', 'Locker Use', 'Standard Equipment', 'Student Support'],
    featured: false,
    status: 'Active',
    category: 'Student',
    description: 'Affordable access for verified students.',
    restrictions: ['Requires verified student ID', 'Off-peak access only (6 AM–4 PM, weekdays)'],
    sessionLimit: 4,
    facilities: ['Main floor', 'Locker rooms'],
    includedBenefits: ['Gym Access', 'Locker Use', 'Standard Equipment', 'Student Support'],
    excludedBenefits: ['Group Classes', 'Personal Training', 'PT Studio Access', 'VIP Lounge'],
    terms: 'Requires active student verification. Auto-renews monthly; reverify each semester.',
  },
];

export const TRANSACTIONS: Transaction[] = [];

export const SESSIONS: Session[] = [];

export const REVENUE_TREND: MonthDatum[] = [];

export const REVENUE_7D: DayDatum[] = [];

export const REVENUE_SOURCE: LabeledDatum[] = [];

export const MEMBERSHIP_DIST: LabeledDatum[] = [];

export const NOTIFICATIONS: Notification[] = [];

export const PROMOTIONS: Promotion[] = [];

export const ADMINS: Admin[] = [];

export const SUPERADMINS: Admin[] = [];

export const CURRENT: Record<Role, CurrentUser> = {
  admin:      { name: 'Admin',       role: 'Administrator',       initials: 'AD' },
  staff:      { name: 'Staff',       role: 'Front Desk Staff',    initials: 'ST' },
  trainer:    { name: 'James Reyes', role: 'TRAINER',              initials: 'JR' },
  member:     { name: 'Member',      role: 'Member',               initials: 'ME' },
  superadmin: { name: 'Super Admin', role: 'Super Administrator', initials: 'SA' },
};

export const SEED_AUDIT_LOG: AuditLogEntry[] = [];

export const SEED_SESSIONS: ActiveSession[] = [];

export const MESSAGES: any[] = [];
export const CONVERSATIONS: any[] = [];

export const peso = (n: number): string => '₱' + Number(n).toLocaleString('en-PH');

