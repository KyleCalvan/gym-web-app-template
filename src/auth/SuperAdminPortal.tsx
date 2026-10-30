'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SUPERADMIN_NAV, SUPERADMIN_VIEWS } from '../superadmin';
import { useToast } from '../shared/hooks/useToast';
import type { NotifPrefs, Setter, ViewProps } from '../types';
import AuthenticatedShell from './AuthenticatedShell';
import type { loadSuperAdminData } from './superadmin-data';
import type { AccountNextStep } from './account-contract';

type SuperAdminData = Awaited<ReturnType<typeof loadSuperAdminData>>;

export default function SuperAdminPortal({ data, currentSessionId, setupSteps = [] }: {
  data: SuperAdminData; currentSessionId: string; setupSteps?: AccountNextStep[];
}) {
  const router = useRouter();
  const [view, setView] = useState('dashboard');
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({ email: true, sms: false, reminders: true, promos: false });
  const [toastNode, fireToast] = useToast();
  const blockedWrite = useRef(false);
  const readonlySetter = <T,>(): Setter<T> => () => {
    blockedWrite.current = true;
    queueMicrotask(() => {
      if (blockedWrite.current) {
        blockedWrite.current = false;
        fireToast('Super admin changes are not yet connected to the database.', 'error');
      }
    });
  };
  const notify = (message: string) => {
    if (blockedWrite.current) {
      blockedWrite.current = false;
      fireToast('Super admin changes are not yet connected to the database.', 'error');
    } else fireToast(message);
  };
  const me = data.superadmin;
  const superAdminAction: NonNullable<ViewProps['onSuperAdminAction']> = async (action, payload) => {
    const response = await fetch('/api/superadmin/actions', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
    const result: { message?: string } = await response.json();
    if (!response.ok) throw new Error(result.message ?? 'The super admin change could not be saved.');
    router.refresh();
  };
  const View = SUPERADMIN_VIEWS[view] ?? SUPERADMIN_VIEWS.dashboard;
  const props: ViewProps & { readOnly: true } = {
    onNav: setView, role: 'superadmin', currentUser: { id: me.id, name: me.name, avatarUrl: me.avatarUrl },
    onSuperAdminAction: superAdminAction,
    currentUserId: me.id,
    members: data.members, setMembers: readonlySetter(),
    trainers: data.trainers, setTrainers: readonlySetter(),
    plans: data.plans, setPlans: readonlySetter(),
    transactions: data.transactions, setTransactions: readonlySetter(),
    sessions: data.sessions, setSessions: readonlySetter(),
    trainerAvailability: data.trainerAvailability, setTrainerAvailability: readonlySetter(),
    promotions: data.promotions, setPromotions: readonlySetter(),
    staff: data.staff, setStaff: readonlySetter(),
    admins: data.admins, setAdmins: readonlySetter(),
    superadmins: [me], setSuperadmins: readonlySetter(),
    notifications: [], setNotifications: readonlySetter(),
    bookings: [], setBookings: readonlySetter(),
    checkIns: { count: 0, today: new Date().toISOString().slice(0, 10) }, setCheckIns: readonlySetter(),
    checkInHistory: [], setCheckInHistory: readonlySetter(),
    notifPrefs, setNotifPrefs,
    auditLog: data.auditLog, setAuditLog: readonlySetter(),
    activeSessions: data.activeSessions, setActiveSessions: readonlySetter(),
    currentSessionId,
    qrDestinations: data.qrDestinations, setQrDestinations: readonlySetter(),
    today: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    toast: notify, addAudit: () => {},
    readOnly: true,
  };
  return <AuthenticatedShell role="superadmin" roles={['superadmin']}
    user={{ name: me.name, avatarUrl: me.avatarUrl }}
    nav={SUPERADMIN_NAV} view={view} onNav={setView} onSwitchRole={() => {}} setupSteps={setupSteps}>
    <View key={view} {...props} />
    {toastNode}
  </AuthenticatedShell>;
}
