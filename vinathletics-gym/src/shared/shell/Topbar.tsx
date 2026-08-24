// @ts-nocheck
import { CURRENT } from '../../data.ts';
import { Avatar } from '../primitives/Avatar.tsx';
import type { Role } from '../../types.ts';
import './app-shell.css';

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard', members: 'Member Management', plans: 'Membership Plans', payments: 'Payments / Point of Sale',
  reports: 'Revenue & Reports', trainers: 'Trainers & Staff', promotions: 'Promotions', activity: 'Activity Logs',
  coaching: 'Coaching Sessions', membership: 'Membership', pos: 'Point of Sale', transactions: 'My Transactions',
  schedules: 'Trainer Schedules', sessions: 'Assigned Sessions', schedule: 'My Schedule & Availability',
  profile: 'My Profile', notifications: 'Notifications',
};

// Roles that have a Profile nav item — clicking the top-right pill routes there.
const HAS_PROFILE_NAV: Record<Role, boolean> = {
  admin: false,   // TODO: add admin profile
  staff: false,   // TODO: add staff profile
  trainer: true,
  member: true,
};

export function Topbar({ role, view, onNav }: { role: Role; view: string; onNav?: (id: string) => void }) {
  const user = CURRENT[role];
  const hasProfile = HAS_PROFILE_NAV[role];

  const handlePillClick = () => {
    if (hasProfile && onNav) onNav('profile');
  };

  return (
    <div className="topbar">
      <div>
        <div className="path">{role.toUpperCase()} / {(VIEW_TITLES[view] || view).toUpperCase()}</div>
        <h1>{VIEW_TITLES[view] || view}</h1>
      </div>
      <div
        className={'role-pill' + (hasProfile ? ' clickable' : '')}
        onClick={handlePillClick}
        role={hasProfile ? 'button' : undefined}
        tabIndex={hasProfile ? 0 : undefined}
        onKeyDown={(e) => { if (hasProfile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handlePillClick(); } }}
      >
        <Avatar src={user.avatarUrl} name={user.name} size={28} />
        <span className="who"><b>{user.name}</b><span>{user.role}</span></span>
      </div>
    </div>
  );
}
