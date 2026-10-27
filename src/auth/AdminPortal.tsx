'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_NAV, ADMIN_VIEWS } from '../admin';
import { useToast } from '../shared/hooks/useToast';
import type { NotifPrefs, Setter, ViewProps } from '../types';
import AuthenticatedShell from './AuthenticatedShell';
import type { loadAdminData } from './admin-data';

type AdminData = Awaited<ReturnType<typeof loadAdminData>>;

export default function AdminPortal({ data, name, email, profileId, avatarUrl }: {
  data: AdminData; name: string; email: string; profileId: string; avatarUrl?: string;
}) {
  const [view, setView] = useState('dashboard');
  const router = useRouter();
  const [plans, setPlans] = useState(data.plans);
  useEffect(() => setPlans(data.plans), [data.plans]);
  const profilePhoto = avatarUrl ?? data.admins.find((admin) => admin.id === profileId)?.avatarUrl;
  const [initialAction, setInitialAction] = useState<string>();
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({ email: true, sms: false, reminders: true, promos: false });
  const [toastNode, fireToast] = useToast();
  const blockedWrite = useRef(false);
  const readonlySetter = <T,>(): Setter<T> => () => {
    blockedWrite.current = true;
    queueMicrotask(() => {
      if (blockedWrite.current) {
        blockedWrite.current = false;
        fireToast('Manager changes are not yet connected to the database.', 'error');
      }
    });
  };
  const notify = (message: string) => {
    if (blockedWrite.current) {
      blockedWrite.current = false;
      fireToast('Manager changes are not yet connected to the database.', 'error');
    } else fireToast(message);
  };
  const navigate = (next: string, action?: string) => { setView(next); setInitialAction(action); };
  const adminAction: NonNullable<ViewProps['onAdminAction']> = async (action, payload) => {
    const response = await fetch('/api/admin/actions', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, payload }) });
    const result: { message?: string } = await response.json();
    if (!response.ok) throw new Error(result.message ?? 'The manager change could not be saved.');
    router.refresh();
  };
  const View = ADMIN_VIEWS[view] ?? ADMIN_VIEWS.dashboard;
  const props: ViewProps = {
    onNav: navigate, initialAction, role: 'admin',
    onAdminAction: adminAction,
    currentUser: { id: profileId, name, avatarUrl: profilePhoto }, currentUserId: profileId,
    members: data.members, setMembers: readonlySetter(),
    trainers: data.trainers, setTrainers: readonlySetter(),
    plans, setPlans,
    transactions: data.transactions, setTransactions: readonlySetter(),
    sessions: data.sessions, setSessions: readonlySetter(),
    trainerAvailability: data.trainerAvailability, setTrainerAvailability: readonlySetter(),
    promotions: data.promotions, setPromotions: readonlySetter(),
    staff: data.staff, setStaff: readonlySetter(),
    admins: data.admins, setAdmins: readonlySetter(),
    superadmins: [], setSuperadmins: readonlySetter(),
    notifications: [], setNotifications: readonlySetter(),
    bookings: [], setBookings: readonlySetter(),
    checkIns: { count: 0, today: new Date().toISOString().slice(0, 10) }, setCheckIns: readonlySetter(),
    checkInHistory: [], setCheckInHistory: readonlySetter(),
    notifPrefs, setNotifPrefs,
    auditLog: data.auditLog, setAuditLog: readonlySetter(),
    activeSessions: [], setActiveSessions: readonlySetter(),
    currentSessionId: null,
    qrDestinations: data.qrDestinations, setQrDestinations: readonlySetter(),
    today: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    toast: notify, addAudit: () => {},
  };

  return <AuthenticatedShell role="admin" roles={['admin']} user={{ name, avatarUrl: profilePhoto }}
    nav={ADMIN_NAV} view={view} onNav={(next) => navigate(next)} onSwitchRole={() => {}}>
    <View key={view + (initialAction ?? '')} {...props} />
    {toastNode}
  </AuthenticatedShell>;
}
