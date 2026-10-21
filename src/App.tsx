'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type { ComponentType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import Landing from './landing';
import LoginPage from './LoginPage.tsx';
import Sidebar from './shared/shell/Sidebar.tsx';
import { Topbar } from './shared/shell/Topbar.tsx';
import { ProfileMenu } from './shared/shell/ProfileMenu.tsx';
import MemberPromotionModal from './member/MemberPromotionModal.tsx';
import { chooseLoginPromotion } from './member/promotionVisibility.ts';
import { useToast } from './shared/hooks/useToast.tsx';
import {
  CURRENT,
  ROLE_LABEL,
  MEMBERS,
  TRAINERS,
  PLANS,
  TRANSACTIONS,
  SESSIONS,
  PROMOTIONS,
  STAFF,
  ADMINS,
  SUPERADMINS,
  NOTIFICATIONS,
  SEED_AUDIT_LOG,
  SEED_SESSIONS,
} from './data.ts';

import { ADMIN_NAV, ADMIN_VIEWS } from './admin';
import { STAFF_NAV, STAFF_VIEWS } from './staff';
import { TRAINER_NAV, TRAINER_VIEWS } from './trainer';
import { MEMBER_NAV, MEMBER_VIEWS } from './member';
import { SUPERADMIN_NAV, SUPERADMIN_VIEWS } from './superadmin';
import { dur, ease } from './motion.tsx';
import type {
  ActiveSession, Admin, AuditLogEntry, AuditLevel, CheckInRecord, Member, NavSection,
  Notification, NotifPrefs, Plan, Promotion, PromotionRedemption, Role, Session, Staff, Trainer,
  Transaction, ViewProps, CheckIns, QrDestination, TrainerAvailability,
} from './types.ts';
import { DEFAULT_QR_DESTINATIONS } from './qrDestinations.ts';
import { isTrainerAvailability } from './trainer/availability.ts';
import AccountStatus from './auth/AccountStatus';
import './auth/account-status.css';

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

const today = (): string => new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function App({ initialLoginTab = 'login' }: { initialLoginTab?: 'login' | 'register' } = {}) {
  const { status } = useSession();
  if (status === 'loading') return <main className="account-status" role="status">Loading your Account…</main>;
  if (status === 'authenticated') return <AccountStatus />;
  return <DemoApp initialLoginTab={initialLoginTab} />;
}

function DemoApp({ initialLoginTab = 'login' }: { initialLoginTab?: 'login' | 'register' }) {
  const pathname = usePathname();
  const { data: authSession, status: authStatus } = useSession();
  const handledDemoSession = useRef<string | null>(null);

  const [members, setMembers]               = useState<Member[]>(() => [...MEMBERS]);
  const [trainers, setTrainers]             = useState<Trainer[]>(() => [...TRAINERS]);
  const [plans, setPlans]                   = useState<Plan[]>(() => [...PLANS]);
  const [transactions, setTransactions]     = useState<Transaction[]>(() => [...TRANSACTIONS]);
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState('GCash');
  const [qrDestinations, setQrDestinations] = useState<QrDestination[]>(DEFAULT_QR_DESTINATIONS);
  const [qrDestinationsLoaded, setQrDestinationsLoaded] = useState(false);
  const [sessions, setSessions]             = useState<Session[]>(() => [...SESSIONS]);
  const [trainerAvailability, setTrainerAvailability] = useState<TrainerAvailability[]>([]);
  const [trainerAvailabilityLoaded, setTrainerAvailabilityLoaded] = useState(false);
  const [promotions, setPromotions]         = useState<Promotion[]>(() => [...PROMOTIONS]);
  const [promotionRedemptions, setPromotionRedemptions] = useState<PromotionRedemption[]>([]);
  const [staff, setStaff]                   = useState<Staff[]>(() => [...STAFF]);
  const [admins, setAdmins]                 = useState<Admin[]>(() => [...ADMINS]);
  const [superadmins, setSuperadmins]       = useState<Admin[]>(() => [...SUPERADMINS]);
  const [auditLog, setAuditLog]             = useState<AuditLogEntry[]>(() => [...SEED_AUDIT_LOG]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>(() => [...SEED_SESSIONS]);
  const [notifications, setNotifications]   = useState<Notification[]>(() => NOTIFICATIONS.map((n) => ({ ...n })));
  const [bookings, setBookings]             = useState<Session[]>(() => SESSIONS.filter((s) => s.member === CURRENT.member.name && s.status !== 'Cancelled'));
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null);
  const [authorizedRoles, setAuthorizedRoles] = useState<Role[]>(['member']);
  const [demoIdentity, setDemoIdentity] = useState<{ email: string; name: string; role: Role } | null>(null);
  const [checkIns, setCheckIns]             = useState<CheckIns>({ count: 0, today: today() });
  const [checkInHistory, setCheckInHistory] = useState<CheckInRecord[]>([]);
  const [notifPrefs, setNotifPrefs]         = useState<NotifPrefs>({ email: true, sms: false, reminders: true, promos: false });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('vinathletics.qrDestinations');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setQrDestinations(parsed.filter((item): item is QrDestination =>
            typeof item?.id === 'string' && typeof item?.label === 'string' && typeof item?.url === 'string',
          ));
        }
      }
    } catch (error) {
      console.error('Could not load saved gym QR destinations.', error);
    } finally {
      setQrDestinationsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!qrDestinationsLoaded) return;
    try {
      window.localStorage.setItem('vinathletics.qrDestinations', JSON.stringify(qrDestinations));
    } catch (error) {
      console.error('Could not save gym QR destinations to this browser.', error);
    }
  }, [qrDestinations, qrDestinationsLoaded]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('vinathletics.trainerAvailability');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setTrainerAvailability(parsed.filter(isTrainerAvailability));
        }
      }
    } catch (error) {
      console.error('Could not load saved trainer availability.', error);
    } finally {
      setTrainerAvailabilityLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!trainerAvailabilityLoaded) return;
    try {
      window.localStorage.setItem('vinathletics.trainerAvailability', JSON.stringify(trainerAvailability));
    } catch (error) {
      console.error('Could not save trainer availability to this browser.', error);
    }
  }, [trainerAvailability, trainerAvailabilityLoaded]);

  // Current superadmin session id (used by Sessions view to exclude self).
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const [route, setRoute]                   = useState<'landing' | '/login' | 'app'>(() => pathname === '/login' ? '/login' : 'landing');
  const [loginFlow, setLoginFlow]           = useState<{ role: Role; tab: 'login' | 'register' }>({ role: 'member', tab: initialLoginTab });
  const [loggedIn, setLoggedIn]             = useState<boolean>(false);
  const [role, setRole]                     = useState<Role>('member');
  const [view, setView]                     = useState<string>('dashboard');
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [loginPromotion, setLoginPromotion] = useState<Promotion | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const pillRef = useRef<HTMLDivElement>(null);

  // Resolve the actual current user from the dynamic state
  const currentUser = useMemo(() => {
    let user;
    if (role === 'member') user = members.find(m => m.id === currentUserId) || CURRENT.member;
    else if (role === 'trainer') user = trainers.find(t => t.id === currentUserId) || CURRENT.trainer;
    else if (role === 'staff') user = staff.find(s => s.id === currentUserId) || CURRENT.staff;
    else if (role === 'admin') user = admins.find(a => a.id === currentUserId) || CURRENT.admin;
    else if (role === 'superadmin') user = superadmins.find(s => s.id === currentUserId) || CURRENT.superadmin;
    else user = CURRENT[role];
    const userEmail = 'email' in user ? user.email : undefined;

    if (demoIdentity?.role === role) {
      return {
        ...user,
        id: currentUserId || `DEMO-${role}`,
        name: demoIdentity.name,
        email: demoIdentity.email,
        role: ROLE_LABEL[role],
      };
    }
    if (authStatus === 'authenticated' && authSession?.user) {
      return {
        ...user,
        id: authSession.user.id,
        name: authSession.user.name || user.name,
        email: authSession.user.email || userEmail,
        avatarUrl: authSession.user.image || user.avatarUrl,
        role: ROLE_LABEL[role],
      };
    }
    return user;
  }, [role, members, trainers, staff, admins, superadmins, currentUserId, authStatus, authSession, demoIdentity]);

  // Theme: dark is the default and the layout script has already applied a
  // stored light preference to <html> before React mounted, so read the
  // element back as the source of truth rather than re-reading storage.
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  });


  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('vinathletics-theme', theme); } catch { /* storage blocked — session only */ }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const [toastNode, fireToast] = useToast();

  useEffect(() => {
    let active = true;
    fetch('/api/gym-plans')
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Membership plans could not be loaded.';
          throw new Error(message);
        }
        if (!result || typeof result !== 'object' || !('plans' in result) || !Array.isArray(result.plans)) {
          throw new Error('The membership plan service returned an invalid catalog.');
        }
        if (active) setPlans(result.plans as Plan[]);
      })
      .catch((error: unknown) => {
        console.error('Could not load the database membership plan catalog.', error);
      });
    return () => { active = false; };
  }, [setPlans]);

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
  const addAudit = (level: AuditLevel, action: string, details?: string, actorRole: Role = role) => {
    setAuditLog((prev) => {
      const entry: AuditLogEntry = {
        id: `LOG-${crypto.randomUUID()}`,
        at: new Date().toISOString(),
        level,
        actor: currentUser?.name || CURRENT[role].name,
        actorRole,
        action,
        details,
      };
      const next = [entry, ...prev];
      return next.length > 500 ? next.slice(0, 500) : next;
    });
  };

  const handleLogin = (r: Role, userId?: string, signedInMember?: Member) => {
    const roleIsAssigned = authStatus === 'authenticated'
      ? Boolean(authSession?.user?.roles?.includes(r))
      : r === 'member';
    if (!roleIsAssigned) {
      fireToast('This account is not assigned to that interface.');
      return;
    }

    const memberForLogin = r === 'member'
      ? signedInMember || members.find((member) => member.id === userId) || members[0]
      : null;

    setRole(r);
    setDemoIdentity(null);
    setView('dashboard');
    setLoggedIn(true);
    setRoute('app');
    if (r === 'member') setCurrentUserId(memberForLogin?.id || userId || null);
    else if (r === 'trainer') setCurrentUserId(userId || null);
    else setCurrentUserId(null);
    setBookings(SESSIONS.filter((s) => s.member === (memberForLogin?.name || CURRENT[r].name) && s.status !== 'Cancelled'));
    setNotifications(NOTIFICATIONS.map((n) => ({ ...n })));

    if (memberForLogin) {
      let promoStorage;
      try { promoStorage = window.localStorage; } catch { /* private mode can disable storage */ }
      setLoginPromotion(chooseLoginPromotion(promotions, memberForLogin, promoStorage));
    } else {
      setLoginPromotion(null);
    }

    // Audit + active session registration.
    const name = memberForLogin?.name || CURRENT[r].name;
    addAudit('info', 'Logged in', name);
    const sessionId = 'SESS-' + Date.now();
    setCurrentSessionId(sessionId);
    setActiveSessions((prev) => [
      ...prev.filter((s) => s.userId !== (userId || name)),
      { id: sessionId, userId: userId || name, userName: name, role: r, loginAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() },
    ]);
  };

  const handleDemoLogin = (session: { email: string; name: string; role: Role; roles: Role[]; expiresAt: number }) => {
    if (authStatus === 'authenticated'
      || !['member', 'staff', 'trainer', 'admin', 'superadmin'].includes(session.role)
      || !session.roles.includes(session.role)
      || session.expiresAt <= Math.floor(Date.now() / 1000)) {
      fireToast('The demo session could not be verified.');
      return;
    }

    const identity = { email: session.email, name: session.name, role: session.role };
    const sessionKey = `${identity.email}:${session.expiresAt}`;
    if (handledDemoSession.current === sessionKey) return;
    handledDemoSession.current = sessionKey;
    setDemoIdentity(identity);
    setAuthorizedRoles(session.roles);
    setRole(session.role);
    setView('dashboard');
    setLoggedIn(true);
    setCurrentUserId(`DEMO-${session.role}`);
    setRoute('app');
    setShowNotifications(false);
    setShowProfileMenu(false);
    setBookings(SESSIONS.filter((booking) => booking.member === identity.name && booking.status !== 'Cancelled'));
    setNotifications(NOTIFICATIONS.map((notification) => ({ ...notification })));

    const sessionId = `DEMO-SESS-${session.expiresAt}`;
    setCurrentSessionId(sessionId);
    setActiveSessions((previous) => [
      ...previous.filter((activeSession) => activeSession.userId !== identity.email),
      {
        id: sessionId,
        userId: identity.email,
        userName: identity.name,
        role: session.role,
        loginAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
    ]);
    addAudit('info', 'Demo login', 'Development demo account', session.role);
  };

  const handleRoleSwitch = (nextRole: Role) => {
    if (!authorizedRoles.includes(nextRole)) {
      fireToast('That interface is not assigned to your account.');
      return;
    }
    if (nextRole === role) return;

    const email = authSession?.user?.email?.trim().toLowerCase();
    const roleUserId = nextRole === 'member'
      ? members.find((member) => member.email.trim().toLowerCase() === email)?.id
      : nextRole === 'staff'
        ? staff.find((person) => person.email.trim().toLowerCase() === email)?.id
        : nextRole === 'admin'
          ? admins.find((admin) => admin.email.trim().toLowerCase() === email)?.id
          : nextRole === 'superadmin'
            ? superadmins.find((admin) => admin.email.trim().toLowerCase() === email)?.id
            : null;

    setRole(nextRole);
    setView('dashboard');
    setCurrentUserId(roleUserId || null);
    setShowNotifications(false);
    setShowProfileMenu(false);
    setIsSidebarOpen(false);
    if (currentSessionId) {
      setActiveSessions((previous) => previous.map((session) => session.id === currentSessionId
        ? { ...session, role: nextRole, lastActiveAt: new Date().toISOString() }
        : session));
    }
    addAudit('info', 'Role interface switched', ROLE_LABEL[nextRole], nextRole);
  };

  useEffect(() => {
    if (authStatus !== 'unauthenticated') return;
    let active = true;
    fetch('/api/demo-session')
      .then(async (response) => {
        if (!response.ok) return;
        const result: unknown = await response.json();
        if (!active || !result || typeof result !== 'object' || !('demoSession' in result)) return;
        const session = result.demoSession;
        if (!session || typeof session !== 'object'
          || !('email' in session) || typeof session.email !== 'string'
          || !('name' in session) || typeof session.name !== 'string'
          || !('role' in session) || typeof session.role !== 'string'
          || !('roles' in session) || !Array.isArray(session.roles)
          || !('expiresAt' in session) || typeof session.expiresAt !== 'number') return;
        handleDemoLogin(session as { email: string; name: string; role: Role; roles: Role[]; expiresAt: number });
      })
      .catch((error: unknown) => {
        console.error('Could not restore the development demo session.', error);
      });
    return () => { active = false; };
  }, [authStatus]);

  const handleLogout = () => {
    if (demoIdentity) {
      void fetch('/api/demo-session', { method: 'DELETE' })
        .catch((error: unknown) => console.error('Could not end the development demo session.', error));
    }
    if (authStatus === 'authenticated') void signOut({ redirect: false });
    const name = currentUser?.name || CURRENT[role].name;
    addAudit('info', 'Logged out', name);
    setActiveSessions((prev) => prev.filter((activeSession) => activeSession.id !== currentSessionId));
    if (currentSessionId) setCurrentSessionId(null);
    setLoggedIn(false);
    setAuthorizedRoles(['member']);
    setDemoIdentity(null);
    handledDemoSession.current = null;
    setView('dashboard');
    setCurrentUserId(null);
    setRoute('landing');
  };

  // A member permanently deletes their own account. The record is removed and
  // the session ends — there's nothing left to be signed in as.
  const handleDeleteAccount = (userId: string) => {
    const target = members.find((m) => m.id === userId);
    const name = target?.name || CURRENT[role].name;
    setMembers((prev) => prev.filter((m) => m.id !== userId));
    addAudit('warn', 'Account deleted', `${name} deleted their own account`);
    handleLogout();
    fireToast('Account deleted');
  };

  const handleNav = (id: string) => {
    if (role === 'member' && id === 'notifications') {
      setShowProfileMenu(false);
      setShowNotifications(true);
      return;
    }
    setShowNotifications(false);
    setShowProfileMenu(false);
    setView(id);
  };

  const handleProfileMenuNav = (id: string) => {
    handleNav(id);
    setShowProfileMenu(false);
    setIsSidebarOpen(false);
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
        onDemoLogin={handleDemoLogin}
        members={members}
        setMembers={setMembers}
        plans={plans}
        defaultRole={loginFlow.role}
        defaultTab={loginFlow.tab}
        onBack={() => {
          navigate('landing');
          if (window.location.pathname === '/login') window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  const roleViews = VIEWS[role];
  const ViewComp: ComponentType<ViewProps> =
    (roleViews && (roleViews[view] as ComponentType<ViewProps>)) ||
    (() => <div className="empty-state">View not available.</div>);


  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        brand="VinAthletics"
        nav={NAV_BY_ROLE[role]}
        active={view}
        onNav={(id) => { handleNav(id); setIsSidebarOpen(false); }}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      <div className="app-main" style={{ flex: 1, minWidth: 0 }}>
        <Topbar
          role={role}
          user={currentUser}
          view={view}
          onNav={handleNav}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onProfileMenu={() => {
            setShowNotifications(false);
            setShowProfileMenu((v) => !v);
          }}
          pillRef={pillRef}
          profileMenuOpen={showProfileMenu}
          notifications={notifications}
          setNotifications={setNotifications}
          notificationsOpen={showNotifications}
          onToggleNotifications={() => {
            setShowProfileMenu(false);
            setShowNotifications((open) => !open);
          }}
          onCloseNotifications={() => setShowNotifications(false)}
          toast={fireToast}
          nav={NAV_BY_ROLE[role]}
        />
        <div className="content">
          <motion.div
            key={`${role}-${view}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
              <ViewComp
                onNav={handleNav}
                role={role}
                currentUser={currentUser}
                members={members} setMembers={setMembers}
                trainers={trainers} setTrainers={setTrainers}
                plans={plans} setPlans={setPlans}
                transactions={transactions} setTransactions={setTransactions}
                preferredPaymentMethod={preferredPaymentMethod}
                setPreferredPaymentMethod={setPreferredPaymentMethod}
                qrDestinations={qrDestinations}
                setQrDestinations={setQrDestinations}
                sessions={sessions} setSessions={setSessions}
                trainerAvailability={trainerAvailability} setTrainerAvailability={setTrainerAvailability}
                promotions={promotions} setPromotions={setPromotions}
                staff={staff} setStaff={setStaff}
                admins={admins} setAdmins={setAdmins}
                superadmins={superadmins} setSuperadmins={setSuperadmins}
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
                promotionRedemptions={promotionRedemptions}
                setPromotionRedemptions={setPromotionRedemptions}
                onDeleteAccount={handleDeleteAccount}
              />
          </motion.div>
        </div>
      </div>
      {loginPromotion && (
        <MemberPromotionModal
          promotion={loginPromotion}
          onClose={() => setLoginPromotion(null)}
          onViewPromotions={() => { setLoginPromotion(null); handleNav('promotions'); }}
          toast={fireToast}
        />
      )}
      <ProfileMenu
        role={role}
        availableRoles={authorizedRoles}
        onSwitchRole={handleRoleSwitch}
        user={currentUser}
        open={showProfileMenu}
        onClose={() => setShowProfileMenu(false)}
        onProfile={() => handleProfileMenuNav('profile')}
        onLogout={() => { handleLogout(); setShowProfileMenu(false); }}
        notifPrefs={notifPrefs}
        setNotifPrefs={setNotifPrefs}
        theme={theme}
        onToggleTheme={toggleTheme}
        triggerRef={pillRef}
      />
      {toastNode}
    </div>
  );
}
