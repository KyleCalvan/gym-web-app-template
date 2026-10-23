/* Client-side data layer.
 *
 * Every admin/staff/trainer/member screen used to read from the hardcoded
 * arrays in `src/data.ts`. This module is the single bridge from the real REST
 * surface (`app/api/**`) into the UI's view types (`src/types.ts`).
 *
 * Two rules keep it safe to import anywhere in the browser bundle:
 *   1. No Prisma or other server-only import may ever appear here.
 *   2. The wire format is treated as an external boundary and normalized
 *      defensively, so a serializer change cannot silently corrupt UI state.
 */

import type {
  CheckInRecord,
  Member,
  MemberStatus,
  Notification,
  Plan,
  Promotion,
  PromoStatus,
  QrDestination,
  Session,
  SessionStatus,
  Staff,
  StaffRole,
  StaffShift,
  StaffStatus,
  Trainer,
  TrainerStatus,
  Transaction,
  TxnStatus,
} from '../types.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
  }
}

/** The request was refused because no usable session exists. */
export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/** The caller is signed in but their role cannot read this endpoint. */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const record = isRecord(payload) ? payload : {};
    const message =
      typeof record.error === 'string'
        ? record.error
        : `Request failed with status ${response.status}.`;
    throw new ApiError(
      message,
      response.status,
      typeof record.requestId === 'string' ? record.requestId : undefined,
    );
  }

  if (payload === null) {
    throw new ApiError('The server returned an empty or malformed response.', response.status);
  }

  return payload as T;
}

/* ------------------------------------------------------------------ *
 * Tolerant accessors for the wire format
 * ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Json {
  return isRecord(value) ? value : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nested(value: unknown, key: string): Json {
  return record(record(value)[key]);
}

function firstString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const value = str(candidate);
    if (value !== null) return value;
  }
  return null;
}

function strings(value: unknown): string[] {
  return arr(value).filter((entry): entry is string => typeof entry === 'string');
}

function dateOnly(value: unknown): string {
  const raw = str(value);
  if (!raw) return '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function clockTime(value: unknown): string {
  const raw = str(value);
  if (!raw) return '';
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(11, 16);
}

/** Server money is stored in centavos; the UI works in pesos. */
function fromCentavos(value: unknown): number {
  const direct = num(value);
  if (direct === null) return 0;
  return Math.round(direct) / 100;
}

function peso(value: unknown): number {
  return num(value) ?? 0;
}

/* ------------------------------------------------------------------ *
 * Adapters: wire -> view types
 * ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

function toMemberStatus(
  rawStatus: string | null,
  expiresAt: string | null,
  deletedAt: string | null,
): MemberStatus {
  if (deletedAt) return 'Expired';

  switch ((rawStatus ?? '').toLowerCase()) {
    case 'frozen':
      return 'Frozen';
    case 'expiring':
      return 'Expiring';
    case 'expired':
    case 'cancelled':
    case 'canceled':
      return 'Expired';
    case 'active': {
      if (expiresAt) {
        const remaining = new Date(expiresAt).getTime() - Date.now();
        if (Number.isFinite(remaining) && remaining <= 7 * DAY_MS) return 'Expiring';
      }
      return 'Active';
    }
    default:
      return 'Expired';
  }
}

export function toMember(payload: unknown): Member {
  const wire = record(payload);
  const user = nested(wire, 'user');
  const deletedAt = str(wire.deletedAt);
  const expiresAt = str(wire.membershipExpiresAt) ?? str(wire.membershipValidUntil);

  return {
    id: firstString(wire.displayNumber, wire.id) ?? '',
    name: firstString(user.name, user.email, wire.name) ?? 'Unnamed member',
    email: firstString(user.email, wire.email) ?? '',
    phone: firstString(wire.phone, user.phone) ?? '',
    plan: firstString(wire.plan, wire.planName) ?? 'No plan',
    status: toMemberStatus(
      firstString(wire.membershipStatus, wire.status),
      expiresAt,
      deletedAt,
    ),
    joined: dateOnly(wire.createdAt) || dateOnly(wire.joined),
    membershipValidUntil: expiresAt,
    weightKg: num(wire.weightKg) ?? undefined,
    heightCm: num(wire.heightCm) ?? undefined,
    deletedAt,
  };
}

export function toMembers(payload: unknown): Member[] {
  return arr(record(payload).members).map(toMember);
}

function toTrainerStatus(raw: string | null): TrainerStatus {
  switch ((raw ?? '').toLowerCase()) {
    case 'on leave':
    case 'onleave':
    case 'on_leave':
      return 'On Leave';
    case 'inactive':
      return 'Inactive';
    default:
      return 'Active';
  }
}

export function toTrainer(payload: unknown): Trainer {
  const wire = record(payload);
  const user = nested(wire, 'user');

  return {
    id: firstString(wire.displayNumber, wire.id) ?? '',
    name: firstString(user.name, user.email) ?? 'Unnamed trainer',
    specialty: firstString(wire.specialty) ?? 'General Training',
    certs: strings(wire.certifications).join(', '),
    rating: num(wire.rating) ?? 0,
    sessionsWeek: num(wire.sessionsWeek) ?? 0,
    status: toTrainerStatus(str(wire.status)),
    sessionPrice: fromCentavos(wire.sessionRate),
    reviews: [],
    avatarUrl: str(wire.avatarUrl) ?? undefined,
    deletedAt: str(wire.deletedAt),
  };
}

export function toTrainers(payload: unknown): Trainer[] {
  return arr(record(payload).trainers).map(toTrainer);
}

export function toPlan(payload: unknown): Plan {
  const wire = record(payload);
  const rawLimit = wire.sessionLimit;
  const numericLimit = typeof rawLimit === 'number' ? rawLimit : Number(rawLimit);

  return {
    name: firstString(wire.name) ?? 'Unnamed plan',
    price: peso(wire.price),
    period: firstString(wire.period) ?? 'mo',
    members: num(wire.members) ?? 0,
    perks: strings(wire.perks),
    featured: wire.featured === true,
    status: str(wire.status) === 'Inactive' ? 'Inactive' : 'Active',
    category: firstString(wire.category) ?? 'Standard',
    description: firstString(wire.description) ?? '',
    restrictions: strings(wire.restrictions),
    sessionLimit:
      rawLimit === 'unlimited' || !Number.isFinite(numericLimit)
        ? 'unlimited'
        : Math.max(0, numericLimit),
    facilities: strings(wire.facilities),
    includedBenefits: strings(wire.includedBenefits),
    excludedBenefits: strings(wire.excludedBenefits),
    terms: firstString(wire.terms) ?? '',
  };
}

export function toPlans(payload: unknown): Plan[] {
  return arr(record(payload).plans).map(toPlan);
}

function toSessionStatus(raw: string | null): SessionStatus {
  switch ((raw ?? '').toLowerCase()) {
    case 'confirmed':
      return 'Confirmed';
    case 'completed':
      return 'Completed';
    case 'cancelled':
    case 'canceled':
    case 'noshow':
    case 'no_show':
      return 'Cancelled';
    default:
      return 'Pending';
  }
}

export function toSession(payload: unknown): Session {
  const wire = record(payload);
  const member = nested(wire, 'member');
  const startTime = clockTime(wire.startTime);
  const endTime = clockTime(wire.endTime);
  const status = toSessionStatus(str(wire.status));

  return {
    id: firstString(wire.id) ?? '',
    member: firstString(member.name, member.email, wire.memberName) ?? `Member #${String(wire.memberId ?? '?')}`,
    trainer: firstString(wire.trainer, wire.trainerName) ?? 'Unassigned',
    date: dateOnly(wire.date),
    time: endTime ? `${startTime}–${endTime}` : startTime,
    type: firstString(wire.type) ?? 'Personal Training',
    status,
    paid: wire.paid === true,
    amount: fromCentavos(wire.priceCentavos),
  };
}

export function toSessions(payload: unknown): Session[] {
  return arr(record(payload).bookings).map(toSession);
}

function toTxnStatus(raw: string | null): TxnStatus {
  switch ((raw ?? '').toLowerCase()) {
    case 'paid':
    case 'successful':
    case 'succeeded':
    case 'completed':
      return 'Paid';
    case 'refunded':
      return 'Refunded';
    case 'failed':
      return 'Failed';
    default:
      return 'Pending';
  }
}

/** The server's ledger is orders + payments; the UI renders it as transactions. */
export function toTransaction(payload: unknown): Transaction {
  const wire = record(payload);
  const member = nested(wire, 'member');
  const lines = arr(wire.lines).map(record);
  const payments = arr(wire.payments).map(record);
  const latestPayment = payments[0] ?? {};
  const total =
    num(wire.totalAmount) ??
    lines.reduce((sum, line) => {
      const quantity = num(line.quantity) ?? 1;
      const unit = num(line.unitPrice) ?? num(line.totalPrice) ?? 0;
      return sum + quantity * unit;
    }, 0);
  const itemLabel = lines
    .map((line) => firstString(line.itemName, line.itemType, line.description))
    .filter((label): label is string => label !== null)
    .join(', ');

  return {
    id: firstString(wire.id) ?? '',
    receiptNumber: firstString(latestPayment.receiptNumber) ?? undefined,
    transactionReference: firstString(latestPayment.reference, wire.reference) ?? undefined,
    member: firstString(member.name, member.email, wire.memberName) ?? 'Walk-in',
    type: itemLabel || 'Order',
    amount: fromCentavos(total),
    fees: num(wire.fees) ? fromCentavos(wire.fees) : undefined,
    paymentState: undefined,
    isSimulated: false,
    method: firstString(latestPayment.method, wire.method) ?? 'Unpaid',
    date: dateOnly(wire.createdAt) || dateOnly(wire.date),
    status: toTxnStatus(firstString(wire.status, latestPayment.status)),
  };
}

export function toTransactions(payload: unknown): Transaction[] {
  return arr(record(payload).orders).map(toTransaction);
}

function toPromoStatus(raw: string | null): PromoStatus {
  return (raw ?? '').toLowerCase() === 'published' ? 'Published' : 'Draft';
}

function formatDiscount(rawType: string | null, value: number): string {
  switch ((rawType ?? '').toLowerCase()) {
    case 'percentage':
      return `${value}%`;
    case 'fixed':
      return `₱${value.toLocaleString('en-PH')}`;
    case 'bundle':
      return `${value} bundle`;
    default:
      return String(value);
  }
}

export function toPromotion(payload: unknown): Promotion {
  const wire = record(payload);
  const rawType = firstString(wire.discountType) ?? 'Percentage';
  const discountValue = num(wire.discountValue) ?? 0;
  const planNames = strings(wire.planNames);

  return {
    id: firstString(wire.id, wire.code) ?? '',
    title: firstString(wire.title, wire.name) ?? 'Untitled promotion',
    discountType:
      rawType.toLowerCase() === 'fixed'
        ? 'Fixed'
        : rawType.toLowerCase() === 'bundle'
          ? 'Bundle'
          : 'Percentage',
    discount: formatDiscount(rawType, discountValue),
    validFrom: dateOnly(wire.validFrom),
    validUntil: dateOnly(wire.validUntil),
    plan: planNames.join(', '),
    code: firstString(wire.code) ?? '',
    maxRedemptions: num(wire.maxRedemptions) ?? 0,
    redemptions: num(wire.redemptions) ?? 0,
    minSpend: fromCentavos(wire.minSpendCentavos),
    status: toPromoStatus(str(wire.status)),
    imageUrl: str(wire.imageUrl) ?? undefined,
    description: str(wire.description) ?? undefined,
  };
}

export function toPromotions(payload: unknown): Promotion[] {
  return arr(record(payload).promotions).map(toPromotion);
}

export function toNotification(payload: unknown, index: number): Notification {
  const wire = record(payload);
  const rawId = num(wire.id) ?? Number(str(wire.id) ?? NaN);
  const createdAt = str(wire.createdAt) ?? str(wire.time);

  return {
    id: Number.isFinite(rawId) ? rawId : index + 1,
    title: firstString(wire.title) ?? 'Notification',
    body: firstString(wire.body, wire.message) ?? '',
    time: createdAt ? dateOnly(createdAt) : '',
    unread: wire.readAt === null || wire.readAt === undefined || wire.unread === true,
    actionView: str(wire.actionView) ?? undefined,
    actionLabel: str(wire.actionLabel) ?? undefined,
  };
}

export function toNotifications(payload: unknown): Notification[] {
  return arr(record(payload).notifications).map(toNotification);
}

const STAFF_ROLES: StaffRole[] = ['Front Desk', 'Sales', 'Manager'];
const STAFF_SHIFTS: StaffShift[] = ['Morning', 'Evening', 'Night'];
const STAFF_STATUSES: StaffStatus[] = ['Active', 'On Leave', 'Inactive'];

function oneOf<T extends string>(candidates: T[], raw: string | null, fallback: T): T {
  return candidates.find((candidate) => candidate.toLowerCase() === (raw ?? '').toLowerCase()) ?? fallback;
}

export function toStaff(payload: unknown): Staff {
  const wire = record(payload);
  const user = nested(wire, 'user');

  return {
    id: firstString(wire.displayNumber, wire.id) ?? '',
    name: firstString(user.name, user.email) ?? 'Unnamed staff',
    role: oneOf(STAFF_ROLES, str(wire.jobRole) ?? str(wire.role), 'Front Desk'),
    shift: oneOf(STAFF_SHIFTS, str(wire.shift), 'Morning'),
    status: oneOf(STAFF_STATUSES, str(wire.status), 'Active'),
    email: firstString(user.email) ?? '',
    phone: firstString(wire.phone, user.phone) ?? '',
    phoneSecondary: str(wire.phoneSecondary) ?? undefined,
    hireDate: dateOnly(wire.hireDate) || dateOnly(wire.createdAt),
    avatarUrl: str(wire.avatarUrl) ?? undefined,
    deletedAt: str(wire.deletedAt),
  };
}

export function toStaffList(payload: unknown): Staff[] {
  return arr(record(payload).staff).map(toStaff);
}

export function toQrDestination(payload: unknown): QrDestination {
  const wire = record(payload);
  return {
    id: firstString(wire.id, wire.label) ?? '',
    label: firstString(wire.label) ?? 'Untitled link',
    url: firstString(wire.url) ?? '',
  };
}

export function toQrDestinations(payload: unknown): QrDestination[] {
  return arr(record(payload).destinations).map(toQrDestination);
}

export function toCheckIn(payload: unknown): CheckInRecord {
  const wire = record(payload);
  const timestamp = str(wire.checkedInAt) ?? str(wire.createdAt);

  return {
    id: firstString(wire.id) ?? '',
    memberId: firstString(wire.memberDisplayNumber, wire.displayNumber, wire.memberId) ?? '',
    date: dateOnly(wire.date) || dateOnly(timestamp),
    time: clockTime(wire.time) || clockTime(timestamp),
  };
}

export function toCheckIns(payload: unknown): CheckInRecord[] {
  const wire = record(payload);
  const source = arr(wire.checkIns).length > 0 ? arr(wire.checkIns) : arr(wire.history);
  return source.map(toCheckIn);
}

/* ------------------------------------------------------------------ *
 * Endpoint wrappers
 * ------------------------------------------------------------------ */

export async function fetchMembers(): Promise<Member[]> {
  return toMembers(await apiFetch('/api/members?limit=500'));
}

export async function fetchMember(memberId: string): Promise<Member> {
  const payload = await apiFetch(`/api/members/${encodeURIComponent(memberId)}`);
  return toMember(record(payload).member);
}

export interface CreateMemberInput {
  /** Existing account id. Omit when supplying an email for a new account. */
  gymUserId?: number;
  /** Email of the account to create or attach the member profile to. */
  email?: string;
  /** Display name used when the email creates a new account. */
  name?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  weightKg?: number;
  heightCm?: number;
}

export async function createMember(input: CreateMemberInput): Promise<Member> {
  const payload = await apiFetch('/api/members', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return toMember(record(payload).member);
}

export interface UpdateMemberInput {
  phone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
}

export async function updateMember(
  memberId: string,
  input: UpdateMemberInput,
): Promise<Member> {
  const payload = await apiFetch(`/api/members/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return toMember(record(payload).member);
}

export async function removeMember(memberId: string): Promise<Member> {
  const payload = await apiFetch(`/api/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
  });
  return toMember(record(payload).member);
}

export interface CreateMembershipInput {
  planName: string;
  startedAt?: string;
  expiresAt?: string;
  status?: 'Active' | 'Frozen' | 'Expired' | 'Cancelled';
}

export async function createMembership(
  memberId: string,
  input: CreateMembershipInput,
): Promise<void> {
  // The membership sub-resource keys on the canonical cuid, while the rest of
  // the UI addresses members by display number ("M-0004"). Resolve once.
  const profile = await apiFetch<{ member?: { id?: string } }>(
    `/api/members/${encodeURIComponent(memberId)}`,
  );
  const canonicalId = profile.member?.id;
  if (!canonicalId) {
    throw new ApiError(`Could not resolve member ${memberId}.`, 404);
  }

  await apiFetch(`/api/members/${encodeURIComponent(canonicalId)}/membership`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createMembershipStatus(
  memberId: string,
  status: 'Active' | 'Expiring' | 'Frozen' | 'Expired' | 'Cancelled',
  reason?: string,
): Promise<void> {
  // Same display-number → cuid resolution as createMembership.
  const profile = await apiFetch<{ member?: { id?: string } }>(
    `/api/members/${encodeURIComponent(memberId)}`,
  );
  const canonicalId = profile.member?.id;
  if (!canonicalId) {
    throw new ApiError(`Could not resolve member ${memberId}.`, 404);
  }

  await apiFetch(`/api/members/${encodeURIComponent(canonicalId)}/membership`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

export async function fetchTrainers(): Promise<Trainer[]> {
  return toTrainers(await apiFetch('/api/trainers?limit=200'));
}

export async function fetchSessions(): Promise<Session[]> {
  return toSessions(await apiFetch('/api/bookings?limit=200'));
}

export async function fetchTransactions(): Promise<Transaction[]> {
  return toTransactions(await apiFetch('/api/orders?limit=200'));
}

export async function fetchPromotions(): Promise<Promotion[]> {
  return toPromotions(await apiFetch('/api/promotions?limit=200'));
}

export interface PromotionInput {
  title: string;
  code: string;
  discountType: 'Percentage' | 'Fixed' | 'Bundle';
  discountValue: number;
  validFrom: string;
  validUntil: string;
  description?: string | null;
  planNames?: string[];
  minSpendCentavos?: number | null;
  maxRedemptions?: number | null;
  imageUrl?: string | null;
}

/**
 * Creates a promotion. The server always stores new promotions as Draft and
 * rejects duplicate codes, so a 409 here is a real, user-facing conflict.
 */
export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  const payload = await apiFetch('/api/promotions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return toPromotion(record(payload).promotion);
}

/**
 * Patches an existing promotion. Passing `{ action: 'publish' }` flips it to
 * Published server-side; `{ action: 'draft' }` does the reverse.
 */
export async function updatePromotion(
  promotionId: string,
  input: Partial<PromotionInput> & { action?: 'publish' | 'draft' },
): Promise<Promotion> {
  const payload = await apiFetch(`/api/promotions/${encodeURIComponent(promotionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return toPromotion(record(payload).promotion);
}

export async function deletePromotion(promotionId: string): Promise<void> {
  await apiFetch(`/api/promotions/${encodeURIComponent(promotionId)}`, {
    method: 'DELETE',
  });
}

export async function fetchNotifications(): Promise<Notification[]> {
  return toNotifications(await apiFetch('/api/notifications'));
}

export async function fetchStaff(): Promise<Staff[]> {
  return toStaffList(await apiFetch('/api/staff?limit=200'));
}

export interface TrainerInput {
  /** Written to the canonical User account, not the trainer profile. */
  name?: string;
  specialty?: string | null;
  bio?: string | null;
  sessionRate?: number;
  status?: 'Active' | 'On Leave' | 'Inactive';
  certifications?: string[];
}

export async function updateTrainer(trainerId: string, input: TrainerInput): Promise<Trainer> {
  const payload = await apiFetch(`/api/trainers/${encodeURIComponent(trainerId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return toTrainer(record(payload).trainer);
}

export async function removeTrainer(trainerId: string): Promise<Trainer> {
  const payload = await apiFetch(`/api/trainers/${encodeURIComponent(trainerId)}`, {
    method: 'DELETE',
  });
  return toTrainer(record(payload).trainer);
}

export interface StaffInput {
  /** Written to the canonical User account, not the staff profile. */
  name?: string;
  jobRole?: 'Front Desk' | 'Sales' | 'Manager';
  shift?: 'Morning' | 'Evening' | 'Night';
  status?: 'Active' | 'On Leave' | 'Inactive';
  phone?: string | null;
  phoneSecondary?: string | null;
}

export async function updateStaff(staffId: string, input: StaffInput): Promise<Staff> {
  const payload = await apiFetch(`/api/staff/${encodeURIComponent(staffId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return toStaff(record(payload).staff);
}

export async function removeStaff(staffId: string): Promise<Staff> {
  const payload = await apiFetch(`/api/staff/${encodeURIComponent(staffId)}`, {
    method: 'DELETE',
  });
  return toStaff(record(payload).staff);
}

export interface CreateBookingInput {
  /** Canonical numeric member id (resolve a display number with fetchMember first). */
  memberId: number;
  trainerId: string;
  /** yyyy-mm-dd */
  date: string;
  /** HH:MM */
  startTime: string;
  /** HH:MM */
  endTime: string;
  notes?: string | null;
}

export async function createBooking(input: CreateBookingInput): Promise<void> {
  await apiFetch('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Books a session from UI-level values. The UI addresses members by display
 * number and picks a single datetime, so resolve the canonical member id and
 * split the datetime into the date/start/end triplet the API expects.
 */
export async function bookSession(input: {
  memberId: string;
  trainerId: string;
  startsAt: string;
  durationMinutes?: number;
  notes?: string | null;
}): Promise<void> {
  const profile = await apiFetch<{ member?: { id?: string; gymUserId?: number } }>(
    `/api/members/${encodeURIComponent(input.memberId)}`,
  );
  // bookings.memberId is the numeric User id, never the member's cuid.
  const canonicalId = profile.member?.gymUserId;
  if (typeof canonicalId !== 'number' || !Number.isInteger(canonicalId)) {
    throw new ApiError(`Could not resolve member ${input.memberId}.`, 404);
  }

  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) {
    throw new ApiError('Choose a valid session date and time.', 400);
  }
  const end = new Date(start.getTime() + (input.durationMinutes ?? 60) * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  await createBooking({
    memberId: canonicalId,
    trainerId: input.trainerId,
    date,
    startTime: clock(start),
    endTime: clock(end),
    notes: input.notes ?? null,
  });
}

export interface CreateTrainerInput {
  name: string;
  email: string;
  specialty?: string;
  certifications?: string[];
  sessionRate?: number;
  bio?: string | null;
}

export async function createTrainer(input: CreateTrainerInput): Promise<Trainer> {
  const payload = await apiFetch('/api/trainers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      specialty: input.specialty ?? null,
      certifications: input.certifications ?? [],
      sessionRate: input.sessionRate ?? 0,
      bio: input.bio ?? null,
    }),
  });
  return toTrainer(record(payload).trainer);
}

export interface CreateStaffInput {
  name: string;
  email: string;
  jobRole: 'Front Desk' | 'Sales' | 'Manager';
  shift: 'Morning' | 'Evening' | 'Night';
  phone?: string;
  phoneSecondary?: string;
}

export async function createStaff(input: CreateStaffInput): Promise<Staff> {
  const payload = await apiFetch('/api/staff', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return toStaff(record(payload).staff);
}

export async function updateQrDestination(
  destinationId: string,
  input: { label?: string; url?: string },
): Promise<void> {
  await apiFetch('/api/qr-destinations', {
    method: 'PATCH',
    body: JSON.stringify({ links: [{ id: destinationId, ...input }] }),
  });
}

export async function createQrDestination(input: { label: string; url: string }): Promise<QrDestination> {
  const payload = await apiFetch('/api/qr-destinations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return toQrDestination(record(payload).destination);
}

export async function deleteQrDestination(destinationId: string): Promise<void> {
  await apiFetch(`/api/qr-destinations?id=${encodeURIComponent(destinationId)}`, {
    method: 'DELETE',
  });
}

export async function fetchQrDestinations(): Promise<QrDestination[]> {
  return toQrDestinations(await apiFetch('/api/qr-destinations'));
}

export async function fetchCheckIns(): Promise<CheckInRecord[]> {
  return toCheckIns(await apiFetch('/api/checkins?limit=200'));
}

export async function fetchPlans(): Promise<Plan[]> {
  return toPlans(await apiFetch('/api/gym-plans'));
}

/* ------------------------------------------------------------------ *
 * Workspace bootstrap
 * ------------------------------------------------------------------ */

/**
 * Resolves to `null` when the signed-in role is not allowed to read the
 * endpoint, so one forbidden collection cannot abort the whole workspace.
 * Genuine failures still reject and are surfaced to the caller.
 */
async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}

export interface WorkspaceSnapshot {
  members: Member[] | null;
  trainers: Trainer[] | null;
  plans: Plan[] | null;
  transactions: Transaction[] | null;
  sessions: Session[] | null;
  promotions: Promotion[] | null;
  notifications: Notification[] | null;
  staff: Staff[] | null;
  checkIns: CheckInRecord[] | null;
  qrDestinations: QrDestination[] | null;
}

/**
 * Loads every collection the current session can see. A role that cannot read
 * an endpoint receives `null` for it rather than an error, which mirrors the
 * per-role navigation the app already renders.
 */
export async function fetchWorkspace(): Promise<WorkspaceSnapshot> {
  const [
    members,
    trainers,
    plans,
    transactions,
    sessions,
    promotions,
    notifications,
    staff,
    checkIns,
    qrDestinations,
  ] = await Promise.all([
    optional(fetchMembers),
    optional(fetchTrainers),
    optional(fetchPlans),
    optional(fetchTransactions),
    optional(fetchSessions),
    optional(fetchPromotions),
    optional(fetchNotifications),
    optional(fetchStaff),
    optional(fetchCheckIns),
    optional(fetchQrDestinations),
  ]);

  return {
    members,
    trainers,
    plans,
    transactions,
    sessions,
    promotions,
    notifications,
    staff,
    checkIns,
    qrDestinations,
  };
}
