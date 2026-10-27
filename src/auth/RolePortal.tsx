'use client';

import { useState } from 'react';
import { StatTile, TabbedCard } from '../shared';
import { ROLE_LABEL } from '../data';
import { ADMIN_NAV } from '../admin';
import { STAFF_NAV } from '../staff';
import { TRAINER_NAV } from '../trainer';
import { SUPERADMIN_NAV } from '../superadmin';
import type { NavSection, Role } from '../types';
import AuthenticatedShell from './AuthenticatedShell';

type StaffRole = Exclude<Role, 'member'>;
export type RoleCounts = {
  members: number; trainers: number; staff: number; admins: number; accounts: number;
  sessions: number; ownSessions: number; transactions: number; plans: number;
  promotions: number; activeSessions: number; auditEvents: number;
};

const navByRole: Record<StaffRole, NavSection[]> = {
  staff: STAFF_NAV, trainer: TRAINER_NAV, admin: ADMIN_NAV, superadmin: SUPERADMIN_NAV,
};

export default function RolePortal({ role, roles, name, email, avatarUrl, counts, setupRequired }: {
  role: StaffRole; roles: Role[]; name: string; email: string; avatarUrl?: string;
  counts: RoleCounts; setupRequired: boolean;
}) {
  const [view, setView] = useState('dashboard');
  const nav = navByRole[role];
  const navTitle = nav.flatMap((section) => section.items).find((item) => item.id === view)?.label ?? 'My Profile';
  const tiles = role === 'superadmin'
    ? [['Accounts', counts.accounts], ['Active Sessions', counts.activeSessions], ['Audit Events', counts.auditEvents], ['Plans', counts.plans]]
    : role === 'admin'
      ? [['Members', counts.members], ['Trainers', counts.trainers], ['Staff', counts.staff], ['Transactions', counts.transactions]]
      : role === 'trainer'
        ? [['My Sessions', counts.ownSessions], ['Gym Sessions', counts.sessions], ['Members', counts.members], ['Plans', counts.plans]]
        : [['Members', counts.members], ['Gym Sessions', counts.sessions], ['Transactions', counts.transactions], ['Plans', counts.plans]];

  return <AuthenticatedShell role={role} roles={roles} user={{ name, avatarUrl }} nav={nav} view={view}
    onNav={setView} onSwitchRole={() => {}}>
    {setupRequired && <div className="member-portal-verify" role="status"><div><strong>Two-step verification setup required</strong><span>Complete security setup before using privileged actions.</span></div></div>}
    {view === 'dashboard' ? <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        {tiles.map(([label, value], index) => <StatTile key={label} label={String(label)} value={value} index={index} />)}
      </div>
      <TabbedCard title={`${ROLE_LABEL[role]} Overview`}>
        <p className="member-dashboard-empty">Welcome, {name}. These figures come from the gym database.</p>
        <div className="member-dashboard-actions">
          {nav.flatMap((section) => section.items).filter((item) => item.id !== 'dashboard').slice(0, 4).map((item) =>
            <button key={item.id} type="button" className="btn btn-outline btn-sm" onClick={() => setView(item.id)}>{item.label}</button>)}
        </div>
      </TabbedCard>
    </> : view === 'profile' ? <TabbedCard title={name}>
      <div className="profile-settings-account-grid">
        <div className="profile-settings-account-item"><div className="eyebrow">Name</div><p>{name}</p></div>
        <div className="profile-settings-account-item"><div className="eyebrow">Email</div><p>{email}</p></div>
        <div className="profile-settings-account-item"><div className="eyebrow">Role</div><p>{ROLE_LABEL[role]}</p></div>
        <div className="profile-settings-account-item"><div className="eyebrow">Account Status</div><p>Active</p></div>
      </div>
    </TabbedCard> : <TabbedCard title={navTitle}>
      <p className="member-dashboard-empty">This section is being connected to your role&apos;s database records. The dashboard counts above are live.</p>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setView('dashboard')}>Back to Dashboard</button>
    </TabbedCard>}
  </AuthenticatedShell>;
}
