// Shared domain types. Single source of truth for the data shapes
// used across the gym management dashboard.

export type Role = 'admin' | 'staff' | 'trainer' | 'member' | 'superadmin';

export type MemberStatus = 'Active' | 'Expiring' | 'Frozen' | 'Expired';
export type TrainerStatus = 'Active' | 'On Leave' | 'Inactive';
export type PlanStatus = 'Active' | 'Inactive';
export type SessionStatus = 'Confirmed' | 'Pending' | 'Cancelled' | 'Completed';
export type TxnStatus = 'Paid' | 'Pending' | 'Refunded' | 'Failed';
export type PaymentState = 'Pending' | 'Processing' | 'Successful' | 'Failed';
export type PromoStatus = 'Published' | 'Draft';
export type DiscountType = 'Percentage' | 'Bundle' | 'Fixed';

export interface Member {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: string;
  status: MemberStatus;
  joined: string;
  avatarUrl?: string;
  membershipValidUntil?: string | null;
  weightKg?: number;
  heightCm?: number;
  deletedAt?: string | null;
}

export type AdminStatus = 'Active' | 'Inactive';

export interface Admin {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phoneSecondary?: string;
  status: AdminStatus;
  createdAt: string;
  avatarUrl?: string;
  deletedAt?: string | null;
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
  avatarUrl?: string;
  deletedAt?: string | null;
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
  description: string;
  restrictions: string[];
  sessionLimit: number | 'unlimited';
  facilities: string[];
  includedBenefits: string[];
  excludedBenefits: string[];
  terms?: string;
}

export interface Transaction {
  id: string;
  receiptNumber?: string;
  // Optional browser-session pricing snapshot; existing transaction/API fields are unchanged.
  taxDetails?: { subtotal: number; base: number; rate: number; amount: number; mode: 'inclusive' | 'exclusive' };
  transactionReference?: string;
  member: string;
  type: string;
  amount: number;
  fees?: number;
  paymentState?: PaymentState;
  isSimulated?: boolean;
  method: string;
  date: string;
  status: TxnStatus;
}

export interface QrDestination {
  id: string;
  label: string;
  url: string;
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

export interface TrainerAvailability {
  id: string;
  trainerId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'unavailable';
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
  description?: string;
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
  phoneSecondary?: string;
  hireDate: string;
  avatarUrl?: string;
  deletedAt?: string | null;
}

export interface Notification {
  id: number;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  actionView?: string;
  actionLabel?: string;
}

export interface CurrentUser {
  name: string;
  role: string;
  initials: string;
  avatarUrl?: string;
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

export interface PromotionRedemption {
  id: string;
  memberId: string;
  promotionId: string;
  code: string;
  redeemedAt: string;
}

export interface CheckIns {
  count: number;
  today: string;
}

export interface CheckInRecord {
  id: string;
  memberId: string;
  date: string;       // ISO yyyy-mm-dd
  time: string;       // HH:MM
}

export type AuditLevel = 'info' | 'warn' | 'error';

export interface AuditLogEntry {
  id: string;
  at: string;                 // ISO timestamp
  level: AuditLevel;
  actor: string;
  actorRole: Role;
  action: string;
  details?: string;
  resource?: string;
  result?: string;
  ipAddress?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  before?: unknown;
  after?: unknown;
}

export interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  role: Role;
  loginAt: string;
  lastActiveAt: string;
}

export interface NotifPrefs {
  email: boolean;
  sms: boolean;
  reminders: boolean;
  promos: boolean;
}

// React setter helpers — keep props concise in app/views
export type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  isRead: boolean;
  attachmentUrl?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  participantRole: Role;
  lastMessage: string;
  updatedAt: string;
  unreadCount: number;
}

// View props shared across every role's view component.
// Each role's view receives this bag from <App/>.
export interface ViewProps {
  onAdminAction?: (action: string, payload: Record<string, unknown>) => Promise<void>;
  onStaffRegisterMember?: (input: { name: string; email: string; phone: string; planName: string }) => Promise<Member>;
  onStaffCheckIn?: (memberId: string) => Promise<void>;
  onStaffSale?: (input: { reference: string; memberId: string; planNames: string[];
    method: 'Cash' | 'GCash'; taxRate: string; taxMode: 'exclusive' | 'inclusive'; cashReceived?: number }) => Promise<Transaction>;
  onStaffProfileSave?: (input: { name: string; email: string; phone: string;
    phoneSecondary: string; avatarUrl?: string }) => Promise<Staff>;
  readOnly?: boolean;
  onProfilePhotoChange?: (url: string) => void;
  onNav: (id: string, action?: string) => void;
  initialAction?: string;
  role: Role;
  currentUser: { id?: string; name: string; avatarUrl?: string };
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
  trainerAvailability: TrainerAvailability[];
  setTrainerAvailability: Setter<TrainerAvailability[]>;
  promotions: Promotion[];
  setPromotions: Setter<Promotion[]>;
  staff: Staff[];
  setStaff: Setter<Staff[]>;
  admins: Admin[];
  setAdmins: Setter<Admin[]>;
  superadmins: Admin[];
  setSuperadmins: Setter<Admin[]>;
  notifications: Notification[];
  setNotifications: Setter<Notification[]>;
  bookings: Session[];
  setBookings: Setter<Session[]>;
  currentUserId: string | null;
  checkIns: CheckIns;
  setCheckIns: Setter<CheckIns>;
  checkInHistory: CheckInRecord[];
  setCheckInHistory: Setter<CheckInRecord[]>;
  notifPrefs: NotifPrefs;
  setNotifPrefs: Setter<NotifPrefs>;
  auditLog: AuditLogEntry[];
  setAuditLog: Setter<AuditLogEntry[]>;
  activeSessions: ActiveSession[];
  setActiveSessions: Setter<ActiveSession[]>;
  currentSessionId: string | null;
  toast: (msg: string) => void;
  today: string;
  addAudit: (level: AuditLevel, action: string, details?: string, actorRole?: Role) => void;
  // Promotion codes a member has redeemed; used by the Promotions page and
  // pricing surfaces to apply discounts.
  promotionRedemptions?: PromotionRedemption[];
  setPromotionRedemptions?: Setter<PromotionRedemption[]>;
  preferredPaymentMethod?: string;
  setPreferredPaymentMethod?: Setter<string>;
  qrDestinations?: QrDestination[];
  setQrDestinations?: Setter<QrDestination[]>;
  // Lets a member permanently remove their own account. App-level because the
  // session can't outlive the record it's signed in as.
  onDeleteAccount?: (userId: string) => void;
}
