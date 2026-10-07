// @ts-nocheck
import { useAnimationControls } from 'framer-motion';
import { motion } from 'framer-motion';
import { CURRENT } from '../../data.ts';
import { Menu } from 'lucide-react';
import { ease } from '../../motion.tsx';
import type { Bell, NavSection, Role } from '../../types.ts';
import { Avatar } from '../primitives/Avatar.tsx';
import { GlobalSearch } from './GlobalSearch.tsx';

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard', members: 'Member Management', plans: 'Membership Plans', payments: 'Payments / Point of Sale',
  reports: 'Revenue & Reports', trainers: 'Trainers & Staff', promotions: 'Promotions', activity: 'Activity Logs',
  coaching: 'Coaching Sessions', membership: 'Membership', pos: 'Point of Sale', transactions: 'My Transactions',
  schedules: 'Trainer Schedules', sessions: 'Assigned Sessions', schedule: 'My Schedule & Availability',
  profile: 'My Profile', notifications: 'Notifications',
};

// Role-scoped overrides: members track progress, not a generic "Dashboard".
const VIEW_TITLES_BY_ROLE: Record<string, Record<string, string>> = {
  member: { dashboard: 'My Progress' },
};

export function Topbar({ role, view, onNav, toggleSidebar, onProfileMenu, pillRef, profileMenuOpen, bell, nav }: {
  role: Role;
  view: string;
  onNav?: (id: string) => void;
  toggleSidebar?: () => void;
  onProfileMenu?: () => void;
  pillRef?: React.RefObject<HTMLElement> | null;
  profileMenuOpen?: boolean;
  bell?: Bell | null;
  nav?: NavSection[];
}) {
  const user = CURRENT[role];
  const title = VIEW_TITLES_BY_ROLE[role]?.[view] || VIEW_TITLES[view] || view;
  const bellControls = useAnimationControls();

  const handlePillClick = () => {
    // The pill opens the profile dropdown (which holds Profile / Log out)
    // rather than jumping straight to the profile page.
    if (onProfileMenu) onProfileMenu();
    else if (onNav) onNav('profile');
  };

  // Bell rings to attention, then hands off to the notification handler.
  const wiggle = () => {
    bellControls.start({
      rotate: [0, -14, 14, -10, 10, -6, 6, 0],
      transition: { duration: 0.55, ease: ease.out },
    });
    if (bell && bell.onClick) bell.onClick();
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
          <div className="path">{role.toUpperCase()} / {title.toUpperCase()}</div>
          <h1 style={{ margin: 0 }}>{title}</h1>
        </div>
      </div>

      {/* Global page search — same place on every view, for every role. */}
      {nav && onNav && (
        <GlobalSearch nav={nav} active={view} onNav={onNav} />
      )}

      <div className="topbar-right">
        {bell && (
          <motion.button
            className="bell-btn"
            aria-label="Notifications"
            onClick={wiggle}
            animate={bellControls}
            whileTap={{ scale: 0.92 }}
          >
            🔔
            {bell.count > 0 && (
              <motion.span
                className="bell-dot"
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </motion.button>
        )}
        <div
          className="role-pill clickable"
          ref={pillRef}
          onClick={handlePillClick}
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={onProfileMenu ? Boolean(profileMenuOpen) : undefined}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePillClick(); } }}
        >
          <Avatar src={user.avatarUrl} name={user.name} size={28} />
          <span className="who"><b>{user.name}</b><span>{user.role}</span></span>
        </div>
      </div>
    </div>
  );
}
