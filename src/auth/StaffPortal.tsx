'use client';

import { useRef, useState } from 'react';
import { STAFF_NAV, STAFF_VIEWS } from '../staff';
import { useToast } from '../shared/hooks/useToast';
import type { Member, NotifPrefs, Setter, Staff, Transaction, ViewProps } from '../types';
import AuthenticatedShell from './AuthenticatedShell';
import type { loadStaffData } from './staff-data';
import type { AccountNextStep } from './account-contract';

type StaffData = Awaited<ReturnType<typeof loadStaffData>>;

export default function StaffPortal({ data, setupSteps = [] }: { data: StaffData; setupSteps?: AccountNextStep[] }) {
  const [view, setView] = useState('dashboard');
  const [members, setMembers] = useState(data.members);
  const [transactions, setTransactions] = useState(data.transactions);
  const [checkIns, setCheckIns] = useState({ count: data.checkInsToday, today: new Date().toISOString().slice(0, 10) });
  const [staff, setStaff] = useState(data.staff);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({ email: true, sms: false, reminders: true, promos: false });
  const [toastNode, fireToast] = useToast();
  const blockedWrite = useRef(false);
  const readonlySetter = <T,>(): Setter<T> => () => {
    blockedWrite.current = true;
    queueMicrotask(() => {
      if (blockedWrite.current) {
        blockedWrite.current = false;
        fireToast('Staff changes are not yet connected to the database.', 'error');
      }
    });
  };
  const notify = (message: string) => {
    if (blockedWrite.current) {
      blockedWrite.current = false;
      fireToast('Staff changes are not yet connected to the database.', 'error');
    } else fireToast(message);
  };
  async function requestJson<T>(url: string, input: Record<string, unknown>, method = 'POST'): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    } catch {
      throw new Error('Could not reach the server. Check your connection and retry.');
    }
    const result = await response.json().catch(() => null) as (T & { message?: string }) | null;
    if (!response.ok) {
      const requestId = response.headers.get('x-request-id');
      const message = result?.message ?? `The staff operation failed (HTTP ${response.status}).`;
      throw new Error(requestId ? `${message} Reference: ${requestId}` : message);
    }
    if (!result) throw new Error('The server returned an unexpected response. Please retry.');
    return result;
  }
  const registerMember: NonNullable<ViewProps['onStaffRegisterMember']> = async (input) => {
    const { member } = await requestJson<{ member: Member }>('/api/staff/members', input);
    setMembers((previous) => [...previous, member]);
    return member;
  };
  const checkIn: NonNullable<ViewProps['onStaffCheckIn']> = async (memberId) => {
    await requestJson('/api/staff/check-ins', { memberId });
    setCheckIns((previous) => ({ ...previous, count: previous.count + 1 }));
  };
  const recordSale: NonNullable<ViewProps['onStaffSale']> = async (input) => {
    const { transaction, membership } = await requestJson<{ transaction: Transaction;
      membership: { memberId: string; planName: string; status: 'Active'; endsAt: string } | null }>('/api/staff/sales', input);
    setTransactions((previous) => previous.some((item) => item.id === transaction.id)
      ? previous : [transaction, ...previous]);
    if (membership) setMembers((previous) => previous.map((item) => item.id === membership.memberId
      ? { ...item, plan: membership.planName, status: membership.status,
        membershipValidUntil: membership.endsAt } : item));
    return transaction;
  };
  const saveProfile: NonNullable<ViewProps['onStaffProfileSave']> = async (input) => {
    const { profile } = await requestJson<{ profile: Pick<Staff, 'name' | 'email' | 'phone' | 'phoneSecondary' | 'avatarUrl'> }>(
      '/api/staff/profile', input, 'PATCH');
    const updated = { ...staff, ...profile };
    setStaff(updated);
    return updated;
  };
  const View = STAFF_VIEWS[view] ?? STAFF_VIEWS.dashboard;
  const props: ViewProps = {
    onNav: setView, role: 'staff', currentUser: { id: staff.id, name: staff.name, avatarUrl: staff.avatarUrl },
    currentUserId: staff.id,
    members, setMembers,
    trainers: data.trainers, setTrainers: readonlySetter(),
    plans: data.plans, setPlans: readonlySetter(),
    transactions, setTransactions,
    sessions: [], setSessions: readonlySetter(),
    trainerAvailability: data.trainerAvailability, setTrainerAvailability: readonlySetter(),
    promotions: [], setPromotions: readonlySetter(),
    staff: [staff], setStaff: readonlySetter(),
    admins: [], setAdmins: readonlySetter(),
    superadmins: [], setSuperadmins: readonlySetter(),
    notifications: [], setNotifications: readonlySetter(),
    bookings: [], setBookings: readonlySetter(),
    checkIns, setCheckIns,
    checkInHistory: [], setCheckInHistory: readonlySetter(),
    notifPrefs, setNotifPrefs,
    auditLog: [], setAuditLog: readonlySetter(),
    activeSessions: [], setActiveSessions: readonlySetter(),
    currentSessionId: null,
    today: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    toast: notify, addAudit: () => {},
    onStaffRegisterMember: registerMember, onStaffCheckIn: checkIn,
    onStaffSale: recordSale, onStaffProfileSave: saveProfile,
  };
  return <AuthenticatedShell role="staff" roles={['staff']}
    user={{ name: staff.name, avatarUrl: staff.avatarUrl }}
    nav={STAFF_NAV} view={view} onNav={setView} onSwitchRole={() => {}} setupSteps={setupSteps}>
    <View key={view} {...props} />
    {toastNode}
  </AuthenticatedShell>;
}
