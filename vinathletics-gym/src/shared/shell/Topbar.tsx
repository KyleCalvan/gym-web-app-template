// @ts-nocheck
import { CURRENT } from '../../data.ts';
import { Menu } from 'lucide-react';
import type { Role } from '../../types.ts';
import { Avatar } from '../primitives/Avatar.tsx';
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

export function Topbar({ role, view, onNav, toggleSidebar }: { role: Role; view: string; onNav?: (id: string) => void; toggleSidebar?: () => void }) {
  const user = CURRENT[role];
  const hasProfile = HAS_PROFILE_NAV[role];

  const handlePillClick = () => {
    if (hasProfile && onNav) onNav('profile');
  };

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="nav-toggle-btn"
          onClick={toggleSidebar}
          aria-label="Open navigation"
        >
          <Menu size={24} />
        </button>
        <div>
          <div className="path">{role.toUpperCase()} / {(VIEW_TITLES[view] || view).toUpperCase()}</div>
          <h1 style={{ margin: 0 }}>{VIEW_TITLES[view] || view}</h1>
        </div>
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
