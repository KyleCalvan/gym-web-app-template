'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Sidebar from '../shared/shell/Sidebar';
import { Topbar } from '../shared/shell/Topbar';
import { ProfileMenu } from '../shared/shell/ProfileMenu';
import { useToast } from '../shared/hooks/useToast';
import { clearAccountBrowserState } from './browser-state';
import { ROLE_LABEL } from '../data';
import type { NavSection, NotifPrefs, Notification, Role } from '../types';

export default function AuthenticatedShell({ role, roles, user, nav, view, onNav, onSwitchRole, children }: {
  role: Role;
  roles: Role[];
  user: { name: string; avatarUrl?: string };
  nav: NavSection[];
  view: string;
  onNav: (view: string) => void;
  onSwitchRole: (role: Role) => void;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({ email: true, sms: false, reminders: true, promos: false });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const pillRef = useRef<HTMLButtonElement>(null);
  const [toastNode, toast] = useToast();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('vinathletics-theme', theme); } catch { /* Keep this session's theme. */ }
  }, [theme]);

  const navigate = (next: string) => { onNav(next); setSidebarOpen(false); setProfileOpen(false); setNotificationsOpen(false); };
  async function logout() {
    try {
      const response = await fetch('/api/auth/signout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callbackUrl: '/login' }),
      });
      if (!response.ok) throw new Error();
      await clearAccountBrowserState();
      window.location.assign('/login');
    } catch { toast('Could not sign out. Please retry.', 'error'); }
  }

  return <div className="app-shell">
    <Sidebar role={role} brand="VinAthletics" user={user} nav={nav} active={view}
      onNav={navigate} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
    <div className="app-main">
      <Topbar role={role} user={{ ...user, role: ROLE_LABEL[role] }} view={view} nav={nav}
        onNav={navigate} toggleSidebar={() => setSidebarOpen((open) => !open)}
        onProfileMenu={() => { setNotificationsOpen(false); setProfileOpen((open) => !open); }}
        pillRef={pillRef} profileMenuOpen={profileOpen}
        notifications={notifications} setNotifications={setNotifications}
        notificationsOpen={notificationsOpen}
        onToggleNotifications={() => { setProfileOpen(false); setNotificationsOpen((open) => !open); }}
        onCloseNotifications={() => setNotificationsOpen(false)} toast={toast} />
      <main className="content">{children}</main>
    </div>
    <ProfileMenu role={role} availableRoles={roles} onSwitchRole={onSwitchRole}
      user={{ ...user, role: ROLE_LABEL[role] }} open={profileOpen} onClose={() => setProfileOpen(false)}
      onProfile={() => navigate('profile')} onLogout={() => void logout()}
      notifPrefs={notifPrefs} setNotifPrefs={setNotifPrefs}
      theme={theme} onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      triggerRef={pillRef} />
    {toastNode}
  </div>;
}
