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
  NOTIFICATIONS,
} from './data.ts';
import { ADMIN_NAV, ADMIN_VIEWS } from './admin';
import { STAFF_NAV, STAFF_VIEWS } from './staff';
import { TRAINER_NAV, TRAINER_VIEWS } from './trainer';
import { MEMBER_NAV, MEMBER_VIEWS, NotificationsModal } from './member';
import { dur, ease } from './motion.tsx';
import type {
  Member, NavSection, Notification, NotifPrefs, Plan, Promotion, Role, Session,
  Trainer, Transaction, ViewProps, CheckIns,
} from './types.ts';

const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  admin: ADMIN_NAV,
  staff: STAFF_NAV,
  trainer: TRAINER_NAV,
  member: MEMBER_NAV,
};

const VIEWS: Record<Role, Record<string, ComponentType<ViewProps>>> = {
  admin:   ADMIN_VIEWS   as unknown as Record<string, ComponentType<ViewProps>>,
  staff:   STAFF_VIEWS   as unknown as Record<string, ComponentType<ViewProps>>,
  trainer: TRAINER_VIEWS as unknown as Record<string, ComponentType<ViewProps>>,
  member:  MEMBER_VIEWS  as unknown as Record<string, ComponentType<ViewProps>>,
};

const SEARCHABLE_ROLES: Role[] = ['admin', 'staff'];

const today = (): string => new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

export default function App() {
  const [members, setMembers]               = useState<Member[]>(() => [...MEMBERS]);
  const [trainers, setTrainers]             = useState<Trainer[]>(() => [...TRAINERS]);
  const [plans, setPlans]                   = useState<Plan[]>(() => [...PLANS]);
  const [transactions, setTransactions]     = useState<Transaction[]>(() => [...TRANSACTIONS]);
  const [sessions, setSessions]             = useState<Session[]>(() => [...SESSIONS]);
  const [promotions, setPromotions]         = useState<Promotion[]>(() => [...PROMOTIONS]);
  const [notifications, setNotifications]   = useState<Notification[]>(() => NOTIFICATIONS.map((n) => ({ ...n })));
  const [bookings, setBookings]             = useState<Session[]>(() => SESSIONS.filter((s) => s.member === CURRENT.member.name && s.status !== 'Cancelled'));
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null);
  const [checkIns, setCheckIns]             = useState<CheckIns>({ count: 86, today: today() });
  const [notifPrefs, setNotifPrefs]         = useState<NotifPrefs>({ email: true, sms: false, reminders: true, promos: false });

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

  const handleLogin = (r: Role, userId?: string) => {
    setRole(r);
    setView('dashboard');
    setLoggedIn(true);
    setRoute('app');
    if (r === 'member') setCurrentUserId(userId || 'M-1042');
    else if (r === 'trainer') setCurrentUserId(userId || 'T-01');
    else setCurrentUserId(null);
    setBookings(SESSIONS.filter((s) => s.member === CURRENT[r].name && s.status !== 'Cancelled'));
    setNotifications(NOTIFICATIONS.map((n) => ({ ...n })));
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setView('dashboard');
    setCurrentUserId(null);
    setRoute('landing');
  };

  const handleSwitchRole = (r: Role) => {
    setRole(r);
    setView('dashboard');
    if (r === 'member') setCurrentUserId('M-1042');
    else if (r === 'trainer') setCurrentUserId('T-01');
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
        onNav={handleNav}
        onLogout={handleLogout}
        onSwitchRole={handleSwitchRole}
        searchable={SEARCHABLE_ROLES.includes(role)}
        bell={role === 'member' ? { count: unread, onClick: () => setShowNotifModal(true) } : null}
      />
      <div>
        <Topbar role={role} view={view} />
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
                notifications={notifications} setNotifications={setNotifications}
                bookings={bookings} setBookings={setBookings}
                currentUserId={currentUserId}
                checkIns={checkIns} setCheckIns={setCheckIns}
                notifPrefs={notifPrefs} setNotifPrefs={setNotifPrefs}
                toast={fireToast}
                today={today()}
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