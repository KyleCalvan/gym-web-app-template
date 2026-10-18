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

export const TRAINERS: Trainer[] = [
  { id: 'T-001', name: 'James Reyes', specialty: 'Strength & Conditioning', certs: 'NASM-CPT, Precision Nutrition', rating: 4.9, sessionsWeek: 22, status: 'Active', sessionPrice: 1200, reviews: [], avatarUrl: '/avatar-t1.jpg' },
  { id: 'T-002', name: 'Sarah Jenkins', specialty: 'Yoga & Mobility', certs: 'RYT-500', rating: 4.7, sessionsWeek: 15, status: 'Active', sessionPrice: 1000, reviews: [], avatarUrl: '/avatar-t2.jpg' },
  { id: 'T-003', name: 'Mike Ross', specialty: 'Powerlifting', certs: 'CSCS', rating: 4.8, sessionsWeek: 18, status: 'On Leave', sessionPrice: 1500, reviews: [], avatarUrl: '/avatar-t3.jpg' },
];

export const STAFF: Staff[] = [
  { id: 'S-01', name: 'Clara Lee', role: 'Front Desk', shift: 'Morning', status: 'Active', email: 'clara.lee@mail.com', phone: '+63 917 000 1111', hireDate: '2025-05-20', avatarUrl: '/avatar-s1.jpg' },
  { id: 'S-02', name: 'David Tan', role: 'Manager', shift: 'Evening', status: 'Active', email: 'david.tan@mail.com', phone: '+63 918 000 2222', hireDate: '2025-01-10', avatarUrl: '/avatar-s2.jpg' },
  { id: 'S-03', name: 'Sofia Ruiz', role: 'Sales', shift: 'Night', status: 'On Leave', email: 'sofia.ruiz@mail.com', phone: '+63 919 000 3333', hireDate: '2025-08-15', avatarUrl: '/avatar-s3.jpg' },
];

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

export const ADMINS: Admin[] = [
  { id: 'A-01', name: 'Admin One', email: 'admin1@mail.com', status: 'Active', createdAt: '2025-03-01', avatarUrl: '/avatar-a1.jpg' },
  { id: 'A-02', name: 'Admin Two', email: 'admin2@mail.com', status: 'Inactive', createdAt: '2025-06-15', avatarUrl: '/avatar-a2.jpg' },
];

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

export const MESSAGES: any[] = [
  { id: 'msg-1', conversationId: 'conv-1', senderId: 'T-001', senderName: 'James Reyes', content: 'Hey Maria! Your form on the squats was great today.', isRead: true, createdAt: '2026-10-14T10:00:00Z' },
  { id: 'msg-2', conversationId: 'conv-1', senderId: 'M-1001', senderName: 'Maria Santos', content: 'Thanks Coach! I felt much more stable.', isRead: true, createdAt: '2026-10-14T10:05:00Z' },
  { id: 'msg-3', conversationId: 'conv-1', senderId: 'T-001', senderName: 'James Reyes', content: 'Keep it up. See you on Thursday!', isRead: false, createdAt: '2026-10-14T10:10:00Z' },
  { id: 'msg-4', conversationId: 'conv-2', senderId: 'M-1002', senderName: 'Ricardo Gomez', content: 'Can we move my session to 5pm?', isRead: true, createdAt: '2026-10-15T08:00:00Z' },
  { id: 'msg-5', conversationId: 'conv-2', senderId: 'T-002', senderName: 'Sarah Jenkins', content: 'Let me check the schedule... yes, 5pm works!', isRead: false, createdAt: '2026-10-15T08:30:00Z' },
];

export const CONVERSATIONS: any[] = [
  { id: 'conv-1', participantId: 'T-001', participantName: 'James Reyes', participantAvatar: '/avatar-t1.jpg', participantRole: 'trainer', lastMessage: 'See you on Thursday!', updatedAt: '2026-10-14T10:10:00Z', unreadCount: 0 },
  { id: 'conv-2', participantId: 'M-1002', participantName: 'Ricardo Gomez', participantAvatar: '/avatar-m2.jpg', participantRole: 'member', lastMessage: 'yes, 5pm works!', updatedAt: '2026-10-15T08:30:00Z', unreadCount: 1 },
];

export const peso = (n: number): string => '₱' + Number(n).toLocaleString('en-PH');

