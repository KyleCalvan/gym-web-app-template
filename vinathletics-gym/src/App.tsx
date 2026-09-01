import { useState } from 'react';
import type { ComponentType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './shared/shell/app-shell.css';
import Landing from './landing';
import LoginPage from './LoginPage.tsx';
import Sidebar from './shared/shell/Sidebar.tsx';
import { Topbar } from './shared/shell/Topbar.tsx';
import { useToast } from './shared/hooks/useToast.tsx';
import {
  CURRENT,
  MEMBERS,
  TRAINERS,
  PLANS,
  TRANSACTIONS,
  SESSIONS,
  PROMOTIONS,
  STAFF,
  ADMINS,
  NOTIFICATIONS,
  SEED_AUDIT_LOG,
  SEED_SESSIONS,
} from './data.ts';
import { ADMIN_NAV, ADMIN_VIEWS } from './admin';
import { STAFF_NAV, STAFF_VIEWS } from './staff';
import { TRAINER_NAV, TRAINER_VIEWS } from './trainer';
import { MEMBER_NAV, MEMBER_VIEWS, NotificationsModal } from './member';
import { SUPERADMIN_NAV, SUPERADMIN_VIEWS } from './superadmin';
import { dur, ease } from './motion.tsx';
import type {
  ActiveSession, Admin, AuditLogEntry, AuditLevel, CheckInRecord, Member, NavSection,
  Notification, NotifPrefs, Plan, Promotion, Role, Session, Staff, Trainer,
  Transaction, ViewProps, CheckIns,
} from './types.ts';

const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  admin: ADMIN_NAV,
  staff: STAFF_NAV,
  trainer: TRAINER_NAV,
  member: MEMBER_NAV,
  superadmin: SUPERADMIN_NAV,
};

const VIEWS: Record<Role, Record<string, ComponentType<ViewProps>>> = {
  admin:      ADMIN_VIEWS      as unknown as Record<string, ComponentType<ViewProps>>,
  staff:      STAFF_VIEWS      as unknown as Record<string, ComponentType<ViewProps>>,
  trainer:    TRAINER_VIEWS    as unknown as Record<string, ComponentType<ViewProps>>,
  member:     MEMBER_VIEWS     as unknown as Record<string, ComponentType<ViewProps>>,
  superadmin: SUPERADMIN_VIEWS as unknown as Record<string, ComponentType<ViewProps>>,
};

const SEARCHABLE_ROLES: Role[] = ['admin', 'staff', 'superadmin'];

const today = (): string => new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function App() {
  const [members, setMembers]               = useState<Member[]>(() => [...MEMBERS]);
  const [trainers, setTrainers]             = useState<Trainer[]>(() => [...TRAINERS]);
  const [plans, setPlans]                   = useState<Plan[]>(() => [...PLANS]);
  const [transactions, setTransactions]     = useState<Transaction[]>(() => [...TRANSACTIONS]);
  const [sessions, setSessions]             = useState<Session[]>(() => [...SESSIONS]);
  const [promotions, setPromotions]         = useState<Promotion[]>(() => [...PROMOTIONS]);
  const [staff, setStaff]                   = useState<Staff[]>(() => [...STAFF]);
  const [admins, setAdmins]                 = useState<Admin[]>(() => [...ADMINS]);
  const [auditLog, setAuditLog]             = useState<AuditLogEntry[]>(() => [...SEED_AUDIT_LOG]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>(() => [...SEED_SESSIONS]);
  const [notifications, setNotifications]   = useState<Notification[]>(() => NOTIFICATIONS.map((n) => ({ ...n })));
  const [bookings, setBookings]             = useState<Session[]>(() => SESSIONS.filter((s) => s.member === CURRENT.member.name && s.status !== 'Cancelled'));
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null);
  const [checkIns, setCheckIns]             = useState<CheckIns>({ count: 0, today: today() });
  const [checkInHistory, setCheckInHistory] = useState<CheckInRecord[]>([]);
  const [notifPrefs, setNotifPrefs]         = useState<NotifPrefs>({ email: true, sms: false, reminders: true, promos: false });

  // Current superadmin session id (used by Sessions view to exclude self).
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const [route, setRoute]                   = useState<'landing' | '/login' | 'app'>('landing');
  const [loginFlow, setLoginFlow]           = useState<{ role: Role; tab: 'login' | 'register' }>({ role: 'member', tab: 'login' });
  const [loggedIn, setLoggedIn]             = useState<boolean>(false);
  const [role, setRole]                     = useState<Role>('member');
  const [view, setView]                     = useState<string>('dashboard');
  const [showNotifModal, setShowNotifModal] = useState<boolean>(false);

  const [toastNode, fireToast] = useToast();

  const navigate = (r: string) => {
    if (r === '/login' || r === '/login?flow=login') {
      setRoute('/login');
      setLoginFlow({ role: 'member', tab: 'login' });
      window.scrollTo(0, 0);
    } else if (r === '/login?flow=register') {
      setRoute('/login');
      setLoginFlow({ role: 'member', tab: 'register' });
      window.scrollTo(0, 0);
    } else if (r === '/admin-login') {
      setRoute('/login');
      setLoginFlow({ role: 'admin', tab: 'login' });
      window.scrollTo(0, 0);
    } else if (r === 'landing') {
      setRoute('landing');
      window.scrollTo(0, 0);
    }
  };

  // Audit-log writer — caps in-memory log at 500 entries to keep memory bounded.
  const addAudit = (level: AuditLevel, action: string, details?: string) => {
    setAuditLog((prev) => {
      const entry: AuditLogEntry = {
        id: 'LOG-' + (prev.length + 1000),
        at: new Date().toISOString(),
        level,
        actor: role === 'superadmin' ? CURRENT.superadmin.name : CURRENT[role].name,
        actorRole: role,
        action,
        details,
      };
      const next = [entry, ...prev];
      return next.length > 500 ? next.slice(0, 500) : next;
    });
  };

  const handleLogin = (r: Role, userId?: string) => {
    setRole(r);
    setView('dashboard');
    setLoggedIn(true);
    setRoute('app');
    if (r === 'member') setCurrentUserId(userId || null);
    else if (r === 'trainer') setCurrentUserId(userId || null);
    else setCurrentUserId(null);
    setBookings(SESSIONS.filter((s) => s.member === CURRENT[r].name && s.status !== 'Cancelled'));
    setNotifications(NOTIFICATIONS.map((n) => ({ ...n })));

    // Audit + active session registration.
    const name = CURRENT[r].name;
    addAudit('info', 'Logged in', name);
    const sessionId = 'SESS-' + Date.now();
    setCurrentSessionId(sessionId);
    setActiveSessions((prev) => [
      ...prev.filter((s) => s.userId !== (userId || name)),
      { id: sessionId, userId: userId || name, userName: name, role: r, loginAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() },
    ]);
  };

  const handleLogout = () => {
    const name = CURRENT[role].name;
    addAudit('info', 'Logged out', name);
    setActiveSessions((prev) => prev.filter((s) => s.userName !== name));
    if (currentSessionId) setCurrentSessionId(null);
    setLoggedIn(false);
    setView('dashboard');
    setCurrentUserId(null);
    setRoute('landing');
  };

  const handleSwitchRole = (r: Role) => {
    const fromName = CURRENT[role].name;
    const toName = CURRENT[r].name;
    addAudit('warn', 'Role switched', `${fromName} → ${toName}`);
    setRole(r);
    setView('dashboard');
    if (r === 'member') setCurrentUserId(null);
    else if (r === 'trainer') setCurrentUserId(null);
    else setCurrentUserId(null);
  };

  const handleNav = (id: string) => {
    if (role === 'member' && id === 'notifications') {
      setShowNotifModal(true);
      return;
    }
    setView(id);
  };

  if (route === 'landing') {
    return (
      <Landing
        onLogin={handleLogin}
        members={members}
        setMembers={setMembers}
        plans={plans}
        promotions={promotions}
        trainers={trainers}
        onNavigate={navigate}
      />
    );
  }

  if (route === '/login') {
    return (
      <LoginPage
        onLogin={handleLogin}
        members={members}
        setMembers={setMembers}
        plans={plans}
        defaultRole={loginFlow.role}
        defaultTab={loginFlow.tab}
        onBack={() => navigate('landing')}
      />
    );
  }

  const roleViews = VIEWS[role];
  const ViewComp: ComponentType<ViewProps> =
    (roleViews && (roleViews[view] as ComponentType<ViewProps>)) ||
    (() => <div className="empty-state">View not available.</div>);

  const unread = notifications.filter((n) => n.unread).length;

  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        brand="VinAthletics"
        nav={NAV_BY_ROLE[role]}
        active={view}
        onNav={(id) => { handleNav(id); setIsSidebarOpen(false); }}
        onLogout={handleLogout}
        onSwitchRole={handleSwitchRole}
        searchable={SEARCHABLE_ROLES.includes(role)}
        bell={role === 'member' ? { count: unread, onClick: () => setShowNotifModal(true) } : null}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Topbar role={role} view={view} onNav={handleNav} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <div className="content">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${role}-${view}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: dur.fast, ease: ease.out }}
            >
              <ViewComp
                onNav={handleNav}
                members={members} setMembers={setMembers}
                trainers={trainers} setTrainers={setTrainers}
                plans={plans} setPlans={setPlans}
                transactions={transactions} setTransactions={setTransactions}
                sessions={sessions} setSessions={setSessions}
                promotions={promotions} setPromotions={setPromotions}
                staff={staff} setStaff={setStaff}
                admins={admins} setAdmins={setAdmins}
                notifications={notifications} setNotifications={setNotifications}
                bookings={bookings} setBookings={setBookings}
                currentUserId={currentUserId}
                checkIns={checkIns} setCheckIns={setCheckIns}
                checkInHistory={checkInHistory} setCheckInHistory={setCheckInHistory}
                notifPrefs={notifPrefs} setNotifPrefs={setNotifPrefs}
                auditLog={auditLog} setAuditLog={setAuditLog}
                activeSessions={activeSessions} setActiveSessions={setActiveSessions}
                currentSessionId={currentSessionId}
                toast={fireToast}
                today={today()}
                addAudit={addAudit}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>
        {showNotifModal && (
          <NotificationsModal
            key="notif"
            onClose={() => setShowNotifModal(false)}
            notifications={notifications}
            setNotifications={setNotifications}
            notifPrefs={notifPrefs}
            setNotifPrefs={setNotifPrefs}
            toast={fireToast}
          />
        )}
      </AnimatePresence>
      {toastNode}
    </div>
  );
}