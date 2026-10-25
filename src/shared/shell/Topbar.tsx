// @ts-nocheck
import { CURRENT, ROLE_LABEL } from '../../data.ts';
import { ChevronDown, Menu } from 'lucide-react';
import type { NavSection, Notification, Role, Setter } from '../../types.ts';
import { Avatar } from '../primitives/Avatar.tsx';
import NotificationsDropdown from './NotificationsDropdown.tsx';

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard', members: 'Member Management', plans: 'Membership Plans', payments: 'Payments / Point of Sale',
  reports: 'Revenue & Reports', trainers: 'Trainers & Staff', promotions: 'Promotions', activity: 'Activity Logs',
  coaching: 'Trainer Availability', membership: 'Membership', pos: 'Point of Sale', transactions: 'My Transactions',
  schedules: 'Trainer Schedules', sessions: 'Assigned Sessions', schedule: 'My Schedule & Availability',
  profile: 'My Profile', notifications: 'Notifications',
};

// Role-specific labels used where a view title differs from its navigation label.
const VIEW_TITLES_BY_ROLE: Record<string, Record<string, string>> = {
  member: { dashboard: 'Dashboard', membership: 'Membership Plans', activity: 'Activity', promotions: 'Promotions' },
  staff: { members: 'Members' },
};

export function Topbar({
  role, user, view, onNav, toggleSidebar, onProfileMenu, pillRef, profileMenuOpen, nav,
  notifications, setNotifications, notificationsOpen, onToggleNotifications, onCloseNotifications, toast,
}: {
  role: Role;
  user: any;
  view: string;
  onNav?: (id: string) => void;
  toggleSidebar?: () => void;
  onProfileMenu?: () => void;
  pillRef?: React.RefObject<HTMLElement> | null;
  profileMenuOpen?: boolean;
  nav?: NavSection[];
  notifications: Notification[];
  setNotifications: Setter<Notification[]>;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  toast: (message: string) => void;
}) {
  const title = nav?.flatMap(section => section.items).find(item => item.id === view)?.label
    || VIEW_TITLES_BY_ROLE[role]?.[view] || VIEW_TITLES[view] || 'Overview';

  const handlePillClick = () => {
    // The pill opens the profile dropdown (which holds Profile / Log out)
    // rather than jumping straight to the profile page.
    if (onProfileMenu) onProfileMenu();
    else if (onNav) onNav('profile');
  };

  return (
    <div className="topbar">
      {/* The hamburger and the title are siblings (not one nested group) so the
         mobile layout can reorder them with flex `order` and place the profile
         widget after the title — see app-shell.css. Desktop keeps its usual
         [title] [search] [bell + pill] row, with the pill grouped beside the
         bell in .topbar-right. */}
      <button
        className="nav-toggle-btn"
        onClick={toggleSidebar}
        aria-label="Open navigation"
      >
        <Menu size={24} />
      </button>
      <div className="path-title">
        <div className="path">{role.toUpperCase()} / {title.toUpperCase()}</div>
        <h1 style={{ margin: 0 }}>{title}</h1>
      </div>

      <div className="topbar-right">
        {/* Search bar removed from header - requirement 7 */}
        <NotificationsDropdown
          open={notificationsOpen}
          onClose={onCloseNotifications}
          onToggle={onToggleNotifications}
          notifications={notifications}
          setNotifications={setNotifications}
          onNav={onNav || (() => {})}
          toast={toast}
        />
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
          <Avatar src={user?.avatarUrl} name={user?.name || 'User'} size={28} />
          {/* role-full is the verbose job title for desktop; role-short is the
             compact badge shown on mobile. CSS swaps them at the breakpoint. */}
          <span className="who">
            <b>{user?.name || 'User'}</b>
            <span className="role-full">{user?.role || 'User'}</span>
            <span className="role-short">{ROLE_LABEL[role] || 'User'}</span>
          </span>
          <ChevronDown className="role-pill-chevron" size={15} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
