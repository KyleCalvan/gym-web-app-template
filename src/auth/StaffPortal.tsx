'use client';

import { useRef, useState } from 'react';
import { STAFF_NAV, STAFF_VIEWS } from '../staff';
import { useToast } from '../shared/hooks/useToast';
import type { Member, NotifPrefs, Setter, Staff, Transaction, ViewProps } from '../types';
import AuthenticatedShell from './AuthenticatedShell';
import type { loadStaffData } from './staff-data';

type StaffData = Awaited<ReturnType<typeof loadStaffData>>;

export default function StaffPortal({ data }: { data: StaffData }) {
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
    const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json() as T & { message?: string };
    if (!response.ok) throw new Error(result.message ?? 'The staff operation could not be completed.');
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
  const savePhoto: NonNullable<ViewProps['onStaffPhotoSave']> = async (avatarUrl) => {
    const { profile } = await requestJson<{ profile: Pick<Staff, 'avatarUrl'> }>(
      '/api/staff/profile', { avatarUrl }, 'PATCH');
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
    onStaffSale: recordSale, onStaffPhotoSave: savePhoto,
  };
  return <AuthenticatedShell role="staff" roles={['staff']}
    user={{ name: staff.name, avatarUrl: staff.avatarUrl }}
    nav={STAFF_NAV} view={view} onNav={setView} onSwitchRole={() => {}}>
    <View key={view} {...props} />
    {toastNode}
  </AuthenticatedShell>;
}
