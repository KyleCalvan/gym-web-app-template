// Shared domain types. Single source of truth for the data shapes
// used across the gym management dashboard.

export type Role = 'admin' | 'staff' | 'trainer' | 'member';

export type MemberStatus = 'Active' | 'Expiring' | 'Frozen' | 'Expired';
export type TrainerStatus = 'Active' | 'On Leave' | 'Inactive';
export type PlanStatus = 'Active' | 'Inactive';
export type SessionStatus = 'Confirmed' | 'Pending' | 'Cancelled' | 'Completed';
export type TxnStatus = 'Paid' | 'Pending' | 'Refunded';
export type PromoStatus = 'Published' | 'Draft';
export type DiscountType = 'Percentage' | 'Bundle' | 'Fixed';

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: string;
  status: MemberStatus;
  joined: string;
}

export interface TrainerReview {
  // intentionally loose — trainer reviews may grow arbitrary fields over time
  [key: string]: unknown;
}

export interface Trainer {
  id: string;
  name: string;
  specialty: string;
  certs: string;
  rating: number;
  sessionsWeek: number;
  status: TrainerStatus;
  sessionPrice: number;
  reviews: TrainerReview[];
}

export interface Plan {
  name: string;
  price: number;
  period: string;
  members: number;
  perks: string[];
  featured: boolean;
  status: PlanStatus;
  category: string;
}

export interface Transaction {
  id: string;
  member: string;
  type: string;
  amount: number;
  method: string;
  date: string;
  status: TxnStatus;
}

export interface Session {
  id: string;
  member: string;
  trainer: string;
  date: string;
  time: string;
  type: string;
  status: SessionStatus;
  paid: boolean;
  amount: number;
  rated?: boolean;
  rating?: number;
}

export interface Promotion {
  id: string;
  title: string;
  discountType: DiscountType;
  discount: string;
  validFrom: string;
  validUntil: string;
  plan: string;
  code: string;
  maxRedemptions: number;
  redemptions: number;
  minSpend: number;
  status: PromoStatus;
  imageUrl?: string;
}

export type StaffRole = 'Front Desk' | 'Sales' | 'Manager';
export type StaffShift = 'Morning' | 'Evening' | 'Night';
export type StaffStatus = 'Active' | 'On Leave' | 'Inactive';

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  shift: StaffShift;
  status: StaffStatus;
  email: string;
  phone: string;
  hireDate: string;
}

export interface Notification {
  id: number;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

export interface CurrentUser {
  name: string;
  role: string;
  initials: string;
}

// Navigation

export interface NavItem {
  id: string;
  label: string;
  ic: string;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

export interface Bell {
  count: number;
  onClick: () => void;
}

// Charts

export interface MonthDatum { m: string; v: number }
export interface DayDatum { d: string; v: number }
export interface LabeledDatum { l: string; v: number; color: string }

// App state

export interface CheckIns {
  count: number;
  today: string;
}

export interface NotifPrefs {
  email: boolean;
  sms: boolean;
  reminders: boolean;
  promos: boolean;
}

// React setter helpers — keep props concise in app/views
export type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

// View props shared across every role's view component.
// Each role's view receives this bag from <App/>.
export interface ViewProps {
  onNav: (id: string) => void;
  members: Member[];
  setMembers: Setter<Member[]>;
  trainers: Trainer[];
  setTrainers: Setter<Trainer[]>;
  plans: Plan[];
  setPlans: Setter<Plan[]>;
  transactions: Transaction[];
  setTransactions: Setter<Transaction[]>;
  sessions: Session[];
  setSessions: Setter<Session[]>;
  promotions: Promotion[];
  setPromotions: Setter<Promotion[]>;
  staff: Staff[];
  setStaff: Setter<Staff[]>;
  notifications: Notification[];
  setNotifications: Setter<Notification[]>;
  bookings: Session[];
  setBookings: Setter<Session[]>;
  currentUserId: string | null;
  checkIns: CheckIns;
  setCheckIns: Setter<CheckIns>;
  notifPrefs: NotifPrefs;
  setNotifPrefs: Setter<NotifPrefs>;
  toast: (msg: string) => void;
  today: string;
}
