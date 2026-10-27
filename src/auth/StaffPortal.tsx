'use client';

import { useRef, useState } from 'react';
import { STAFF_NAV, STAFF_VIEWS } from '../staff';
import { useToast } from '../shared/hooks/useToast';
import type { NotifPrefs, Setter, ViewProps } from '../types';
import AuthenticatedShell from './AuthenticatedShell';
import type { loadStaffData } from './staff-data';

type StaffData = Awaited<ReturnType<typeof loadStaffData>>;

export default function StaffPortal({ data }: { data: StaffData }) {
  const [view, setView] = useState('dashboard');
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
  const staff = data.staff;
  const View = STAFF_VIEWS[view] ?? STAFF_VIEWS.dashboard;
  const props: ViewProps & { readOnly: true } = {
    onNav: setView, role: 'staff', currentUser: { id: staff.id, name: staff.name, avatarUrl: staff.avatarUrl },
    currentUserId: staff.id,
    members: data.members, setMembers: readonlySetter(),
    trainers: data.trainers, setTrainers: readonlySetter(),
    plans: data.plans, setPlans: readonlySetter(),
    transactions: data.transactions, setTransactions: readonlySetter(),
    sessions: [], setSessions: readonlySetter(),
    trainerAvailability: data.trainerAvailability, setTrainerAvailability: readonlySetter(),
    promotions: [], setPromotions: readonlySetter(),
    staff: [staff], setStaff: readonlySetter(),
    admins: [], setAdmins: readonlySetter(),
    superadmins: [], setSuperadmins: readonlySetter(),
    notifications: [], setNotifications: readonlySetter(),
    bookings: [], setBookings: readonlySetter(),
    checkIns: { count: data.checkInsToday, today: new Date().toISOString().slice(0, 10) },
    setCheckIns: readonlySetter(),
    checkInHistory: [], setCheckInHistory: readonlySetter(),
    notifPrefs, setNotifPrefs,
    auditLog: [], setAuditLog: readonlySetter(),
    activeSessions: [], setActiveSessions: readonlySetter(),
    currentSessionId: null,
    today: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    toast: notify, addAudit: () => {},
    readOnly: true,
  };
  return <AuthenticatedShell role="staff" roles={['staff']}
    user={{ name: staff.name, avatarUrl: staff.avatarUrl }}
    nav={STAFF_NAV} view={view} onNav={setView} onSwitchRole={() => {}}>
    <View key={view} {...props} />
    {toastNode}
  </AuthenticatedShell>;
}
