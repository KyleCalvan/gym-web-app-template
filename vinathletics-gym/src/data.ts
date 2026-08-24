import type {
  CurrentUser, DayDatum, LabeledDatum, Member, MonthDatum, Notification,
  Plan, Promotion, Role, Session, Transaction, Trainer,
} from './types.ts';

/* ===== Mock data ===== */
export const INITIALS = (n: string): string =>
  n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

export const MEMBERS: Member[] = [
  { id: 'M-1042', name: 'Juan Dela Cruz',  email: 'juan.delacruz@mail.com', phone: '+63 917 220 1145', plan: 'Premium', status: 'Active',   joined: 'Feb 12, 2025' },
  { id: 'M-1043', name: 'Maria Santos',    email: 'maria.santos@mail.com',   phone: '+63 918 442 0091', plan: 'Basic',   status: 'Active',   joined: 'Jun 03, 2025' },
  { id: 'M-1044', name: 'Carlo Reyes',     email: 'carlo.reyes@mail.com',    phone: '+63 920 118 7723', plan: 'Elite',   status: 'Active',   joined: 'Jan 28, 2025' },
  { id: 'M-1045', name: 'Angela Torres',   email: 'angela.torres@mail.com',  phone: '+63 915 502 3387', plan: 'Premium', status: 'Expiring', joined: 'Aug 09, 2024' },
  { id: 'M-1046', name: 'Miguel Ramos',    email: 'miguel.ramos@mail.com',   phone: '+63 919 774 5510', plan: 'Basic',   status: 'Frozen',   joined: 'Mar 30, 2025' },
  { id: 'M-1047', name: 'Bea Fernandez',   email: 'bea.fernandez@mail.com',  phone: '+63 916 331 9982', plan: 'Elite',   status: 'Active',   joined: 'Jul 15, 2025' },
  { id: 'M-1048', name: 'Paolo Villanueva',email: 'paolo.v@mail.com',        phone: '+63 921 887 4402', plan: 'Premium', status: 'Expired',  joined: 'Nov 02, 2024' },
];

export const TRAINERS: Trainer[] = [
  { id: 'T-01', name: 'James Reyes', specialty: 'Strength & Conditioning', certs: 'NASM-CPT, CSCS', rating: 4.9, sessionsWeek: 14, status: 'Active',   sessionPrice: 900,  reviews: [] },
  { id: 'T-02', name: 'Diane Cruz',  specialty: 'Yoga & Mobility',         certs: 'RYT-500',        rating: 4.8, sessionsWeek: 11, status: 'Active',   sessionPrice: 800,  reviews: [] },
  { id: 'T-03', name: 'Marco Villa', specialty: 'HIIT & Fat Loss',         certs: 'ACE-CPT',        rating: 4.7, sessionsWeek: 9,  status: 'Active',   sessionPrice: 850,  reviews: [] },
  { id: 'T-04', name: 'Sofia Lim',   specialty: 'Powerlifting',            certs: 'USAPL Coach',    rating: 5.0, sessionsWeek: 6,  status: 'On Leave', sessionPrice: 1100, reviews: [] },
];

export const PLANS: Plan[] = [
  { name: 'Basic',   price: 1499, period: 'mo', members: 214, perks: ['Gym floor access','Locker access','1 free assessment'],                                          featured: false, status: 'Active', category: 'Membership' },
  { name: 'Premium', price: 2499, period: 'mo', members: 356, perks: ['Everything in Basic','Group classes','2 PT sessions / mo','Sauna access'],                  featured: true,  status: 'Active', category: 'Membership' },
  { name: 'Elite',   price: 3999, period: 'mo', members: 98,  perks: ['Everything in Premium','Unlimited PT sessions','Nutrition plan','Priority booking'],          featured: false, status: 'Active', category: 'Membership' },
];

export const TRANSACTIONS: Transaction[] = [
  { id: 'TXN-8821', member: 'Juan Dela Cruz',  type: 'Membership Renewal',     amount: 2499, method: 'GCash', date: 'Aug 19, 2026', status: 'Paid' },
  { id: 'TXN-8820', member: 'Bea Fernandez',   type: 'PT Package (10x)',       amount: 8000, method: 'Card',  date: 'Aug 19, 2026', status: 'Paid' },
  { id: 'TXN-8819', member: 'Miguel Ramos',    type: 'Membership Freeze Fee',  amount: 200,  method: 'Cash',  date: 'Aug 18, 2026', status: 'Paid' },
  { id: 'TXN-8818', member: 'Angela Torres',   type: 'Membership Renewal',     amount: 2499, method: 'Card',  date: 'Aug 18, 2026', status: 'Pending' },
  { id: 'TXN-8817', member: 'Carlo Reyes',     type: 'Merchandise',            amount: 650,  method: 'Cash',  date: 'Aug 17, 2026', status: 'Paid' },
  { id: 'TXN-8816', member: 'Paolo Villanueva',type: 'Membership Renewal',     amount: 2499, method: 'GCash', date: 'Aug 16, 2026', status: 'Refunded' },
];

export const SESSIONS: Session[] = [
  { id: 'S-401', member: 'Juan Dela Cruz',   trainer: 'James Reyes',  date: 'Aug 20, 2026', time: '7:00 AM', type: 'Strength',     status: 'Confirmed', paid: true,  amount: 900 },
  { id: 'S-402', member: 'Bea Fernandez',    trainer: 'Diane Cruz',   date: 'Aug 20, 2026', time: '9:00 AM', type: 'Yoga',         status: 'Confirmed', paid: true,  amount: 800 },
  { id: 'S-403', member: 'Carlo Reyes',      trainer: 'Marco Villa',  date: 'Aug 20, 2026', time: '5:30 PM', type: 'HIIT',         status: 'Pending',   paid: false, amount: 850 },
  { id: 'S-404', member: 'Angela Torres',    trainer: 'James Reyes',  date: 'Aug 21, 2026', time: '6:00 PM', type: 'Strength',     status: 'Confirmed', paid: true,  amount: 900 },
  { id: 'S-405', member: 'Maria Santos',     trainer: 'Sofia Lim',    date: 'Aug 22, 2026', time: '8:00 AM', type: 'Powerlifting', status: 'Cancelled', paid: false, amount: 1100 },
  { id: 'S-396', member: 'Juan Dela Cruz',   trainer: 'James Reyes',  date: 'Aug 12, 2026', time: '6:30 AM', type: 'Strength',     status: 'Completed', paid: true,  amount: 900,  rated: true,  rating: 5 },
  { id: 'S-393', member: 'Juan Dela Cruz',   trainer: 'Diane Cruz',   date: 'Aug 14, 2026', time: '10:00 AM', type: 'Yoga',        status: 'Completed', paid: true,  amount: 800,  rated: false },
];

export const REVENUE_TREND: MonthDatum[] = [
  { m: 'Mar', v: 412000 }, { m: 'Apr', v: 438000 }, { m: 'May', v: 401000 },
  { m: 'Jun', v: 465000 }, { m: 'Jul', v: 489000 }, { m: 'Aug', v: 512000 },
];

export const REVENUE_7D: DayDatum[] = [
  { d: 'Wed', v: 18500 }, { d: 'Thu', v: 21200 }, { d: 'Fri', v: 26800 }, { d: 'Sat', v: 32100 },
  { d: 'Sun', v: 19400 }, { d: 'Mon', v: 15300 }, { d: 'Tue', v: 22900 },
];

export const REVENUE_SOURCE: LabeledDatum[] = [
  { l: 'Memberships', v: 62, color: 'var(--ink)' },
  { l: 'PT Sessions', v: 24, color: 'var(--signal)' },
  { l: 'POS / Retail',v: 9,  color: 'var(--court)' },
  { l: 'Other',       v: 5,  color: 'var(--amber)' },
];

export const MEMBERSHIP_DIST: LabeledDatum[] = [
  { l: 'Basic',   v: 214, color: 'var(--steel)' },
  { l: 'Premium', v: 356, color: 'var(--signal)' },
  { l: 'Elite',   v: 98,  color: 'var(--ink)' },
];

export const NOTIFICATIONS: Notification[] = [
  { id: 1, title: 'Session confirmed with James Reyes', body: 'Tomorrow, 7:00 AM — Strength & Conditioning', time: '2h ago', unread: true  },
  { id: 2, title: 'Payment received',                  body: '₱2,499 for Premium membership renewal',      time: '1d ago', unread: true  },
  { id: 3, title: 'New promotion available',           body: 'Bring a Friend — 30% off annual plans',       time: '3d ago', unread: false },
  { id: 4, title: 'Membership expiring soon',          body: 'Your plan renews on Sep 12, 2026',            time: '5d ago', unread: false },
];

export const PROMOTIONS: Promotion[] = [
  { id: 'PROMO-01', title: 'New Member Special',    discountType: 'Percentage', discount: '20%',         validFrom: 'Jul 01, 2026', validUntil: 'Dec 31, 2026', plan: 'Any Plan',     code: 'NEWFIT20', maxRedemptions: 500, redemptions: 214, minSpend: 0,    status: 'Published' },
  { id: 'PROMO-02', title: 'Personal Training BOGO',discountType: 'Bundle',     discount: 'Buy 10 Get 5', validFrom: 'Jun 01, 2026', validUntil: 'Nov 30, 2026', plan: 'Any Plan',     code: 'PTBOGO',   maxRedemptions: 200, redemptions: 87,  minSpend: 8000, status: 'Published' },
  { id: 'PROMO-03', title: 'Bring a Friend',        discountType: 'Percentage', discount: '30%',         validFrom: 'Aug 01, 2026', validUntil: 'Oct 15, 2026', plan: 'Annual Plans', code: 'FRIEND30', maxRedemptions: 150, redemptions: 41,  minSpend: 0,    status: 'Published' },
  { id: 'PROMO-04', title: 'Early Bird Membership', discountType: 'Percentage', discount: '15%',         validFrom: 'Sep 01, 2026', validUntil: 'Jan 31, 2027', plan: 'Basic, Premium', code: 'EARLY15', maxRedemptions: 300, redemptions: 0,   minSpend: 0,    status: 'Draft' },
];

export const CURRENT: Record<Role, CurrentUser> = {
  admin:   { name: 'Admin User',     role: 'Administrator',   initials: 'AU' },
  staff:   { name: 'Liza Manalo',    role: 'Front Desk Staff', initials: 'LM' },
  trainer: { name: 'James Reyes',    role: 'Trainer',          initials: 'JR' },
  member:  { name: 'Juan Dela Cruz', role: 'Premium Member',   initials: 'JD' },
};

export const peso = (n: number): string => '₱' + Number(n).toLocaleString('en-PH');
