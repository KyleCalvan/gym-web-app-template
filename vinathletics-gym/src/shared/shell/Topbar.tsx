import { CURRENT } from '../../data.ts';
import type { Role } from '../../types.ts';
import './app-shell.css';

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard', members: 'Member Management', plans: 'Membership Plans', payments: 'Payments / Point of Sale',
  reports: 'Revenue & Reports', trainers: 'Trainers & Staff', promotions: 'Promotions', activity: 'Activity Logs',
  coaching: 'Coaching Sessions', membership: 'Membership', pos: 'Point of Sale', transactions: 'My Transactions',
  schedules: 'Trainer Schedules', sessions: 'Assigned Sessions', schedule: 'My Schedule & Availability',
  profile: 'My Profile', notifications: 'Notifications',
};

export function Topbar({ role, view }: { role: Role; view: string }) {
  const user = CURRENT[role];
  return (
    <div className="topbar">
      <div>
        <div className="path">{role.toUpperCase()} / {(VIEW_TITLES[view] || view).toUpperCase()}</div>
        <h1>{VIEW_TITLES[view] || view}</h1>
      </div>
      <div className="role-pill">
        <span className="av">{user.initials}</span>
        <span className="who"><b>{user.name}</b><span>{user.role}</span></span>
      </div>
    </div>
  );
}
