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

export const SESSIONS: Session[] = [];

export const REVENUE_TREND: MonthDatum[] = [];

export const REVENUE_7D: DayDatum[] = [];

export const REVENUE_SOURCE: LabeledDatum[] = [];

export const MEMBERSHIP_DIST: LabeledDatum[] = [];

export const NOTIFICATIONS: Notification[] = [];

export const PROMOTIONS: Promotion[] = [];

export const ADMINS: Admin[] = [];

export const CURRENT: Record<Role, CurrentUser> = {
  admin:      { name: 'Admin',       role: 'Administrator',       initials: 'AD' },
  staff:      { name: 'Staff',       role: 'Front Desk Staff',    initials: 'ST' },
  trainer:    { name: 'Trainer',     role: 'Trainer',              initials: 'TR' },
  member:     { name: 'Member',      role: 'Member',               initials: 'ME' },
  superadmin: { name: 'Super Admin', role: 'Super Administrator', initials: 'SA' },
};

export const SEED_AUDIT_LOG: AuditLogEntry[] = [];

export const SEED_SESSIONS: ActiveSession[] = [];

export const peso = (n: number): string => '₱' + Number(n).toLocaleString('en-PH');
