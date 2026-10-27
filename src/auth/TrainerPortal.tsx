'use client';

import { useRef, useState } from 'react';
import { TRAINER_NAV, TRAINER_VIEWS } from '../trainer';
import { useToast } from '../shared/hooks/useToast';
import type { NotifPrefs, Setter, ViewProps } from '../types';
import AuthenticatedShell from './AuthenticatedShell';
import type { loadTrainerData } from './trainer-data';

type TrainerData = Awaited<ReturnType<typeof loadTrainerData>>;

export default function TrainerPortal({ data }: { data: TrainerData }) {
  const [view, setView] = useState('dashboard');
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({ email: true, sms: false, reminders: true, promos: false });
  const [toastNode, fireToast] = useToast();
  const blockedWrite = useRef(false);
  const readonlySetter = <T,>(): Setter<T> => () => {
    blockedWrite.current = true;
    queueMicrotask(() => {
      if (blockedWrite.current) {
        blockedWrite.current = false;
        fireToast('Trainer changes are not yet connected to the database.', 'error');
      }
    });
  };
  const notify = (message: string) => {
    if (blockedWrite.current) {
      blockedWrite.current = false;
      fireToast('Trainer changes are not yet connected to the database.', 'error');
    } else fireToast(message);
  };
  const trainer = data.trainer;
  const View = TRAINER_VIEWS[view] ?? TRAINER_VIEWS.dashboard;
  const props: ViewProps = {
    onNav: setView, role: 'trainer', currentUser: { id: trainer.id, name: trainer.name, avatarUrl: trainer.avatarUrl },
    currentUserId: trainer.id,
    members: data.members, setMembers: readonlySetter(),
    trainers: [trainer], setTrainers: readonlySetter(),
    plans: [], setPlans: readonlySetter(),
    transactions: [], setTransactions: readonlySetter(),
    sessions: data.sessions, setSessions: readonlySetter(),
    trainerAvailability: data.trainerAvailability, setTrainerAvailability: readonlySetter(),
    promotions: [], setPromotions: readonlySetter(),
    staff: [], setStaff: readonlySetter(),
    admins: [], setAdmins: readonlySetter(),
    superadmins: [], setSuperadmins: readonlySetter(),
    notifications: [], setNotifications: readonlySetter(),
    bookings: [], setBookings: readonlySetter(),
    checkIns: { count: 0, today: new Date().toISOString().slice(0, 10) }, setCheckIns: readonlySetter(),
    checkInHistory: [], setCheckInHistory: readonlySetter(),
    notifPrefs, setNotifPrefs,
    auditLog: [], setAuditLog: readonlySetter(),
    activeSessions: [], setActiveSessions: readonlySetter(),
    currentSessionId: null,
    qrDestinations: data.qrDestinations, setQrDestinations: readonlySetter(),
    today: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    toast: notify, addAudit: () => {},
  };

  return <AuthenticatedShell role="trainer" roles={['trainer']}
    user={{ name: trainer.name, avatarUrl: trainer.avatarUrl }}
    nav={TRAINER_NAV} view={view} onNav={setView} onSwitchRole={() => {}}>
    <View key={view} {...props} />
    {toastNode}
  </AuthenticatedShell>;
}
