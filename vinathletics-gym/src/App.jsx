import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Landing from './Landing.jsx';
import Sidebar from './Sidebar.jsx';
import { useToast } from './components.jsx';
import {
  CURRENT,
  MEMBERS,
  TRAINERS,
  PLANS,
  TRANSACTIONS,
  SESSIONS,
  PROMOTIONS,
  NOTIFICATIONS,
} from './data.js';
import { ADMIN_NAV, ADMIN_VIEWS } from './views/admin.jsx';
import { STAFF_NAV, STAFF_VIEWS } from './views/staff.jsx';
import { TRAINER_NAV, TRAINER_VIEWS } from './views/trainer.jsx';
import { MEMBER_NAV, MEMBER_VIEWS, NotificationsModal } from './views/member.jsx';
import { dur, ease } from './motion.jsx';

const NAV_BY_ROLE = { admin: ADMIN_NAV, staff: STAFF_NAV, trainer: TRAINER_NAV, member: MEMBER_NAV };
const VIEWS = { admin: ADMIN_VIEWS, staff: STAFF_VIEWS, trainer: TRAINER_VIEWS, member: MEMBER_VIEWS };

// Roles with enough nav items to benefit from the smart search + filters.
const SEARCHABLE_ROLES = ['admin', 'staff'];

const VIEW_TITLES = {
  dashboard:'Dashboard', members:'Member Management', plans:'Membership Plans', payments:'Payments / Point of Sale',
  reports:'Revenue & Reports', trainers:'Trainer Management', promotions:'Promotions', activity:'Activity Logs',
  coaching:'Coaching Sessions', membership:'Membership', pos:'Point of Sale', transactions:'My Transactions',
  schedules:'Trainer Schedules', sessions:'Assigned Sessions', schedule:'My Schedule & Availability',
  profile:'My Profile', notifications:'Notifications',
};

const today = () => new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});

function Topbar({role, view}){
  const user = CURRENT[role];
  return (
    <div className="topbar">
      <div>
        <div className="path">{role.toUpperCase()} / {(VIEW_TITLES[view]||view).toUpperCase()}</div>
        <h1>{VIEW_TITLES[view] || view}</h1>
      </div>
      <div className="role-pill">
        <span className="av">{user.initials}</span>
        <span className="who"><b>{user.name}</b><span>{user.role}</span></span>
      </div>
    </div>
  );
}

export default function App(){
  // ---- Lifted data state (in-memory; refresh resets) ----
  const [members, setMembers]           = useState(() => [...MEMBERS]);
  const [trainers, setTrainers]         = useState(() => [...TRAINERS]);
  const [plans, setPlans]               = useState(() => [...PLANS]);
  const [transactions, setTransactions] = useState(() => [...TRANSACTIONS]);
  const [sessions, setSessions]         = useState(() => [...SESSIONS]);
  const [promotions, setPromotions]     = useState(() => [...PROMOTIONS]);
  const [notifications, setNotifications] = useState(() => NOTIFICATIONS.map(n => ({...n})));
  const [bookings, setBookings]         = useState(() => SESSIONS.filter(s => s.member === CURRENT.member.name).slice(0, 3));
  const [currentUserId, setCurrentUserId] = useState(null);
  const [checkIns, setCheckIns]         = useState({ count: 86, today: today() });
  const [notifPrefs, setNotifPrefs]     = useState({ email: true, sms: false, reminders: true, promos: false });

  // ---- App-level UI state ----
  const [loggedIn, setLoggedIn]       = useState(false);
  const [role, setRole]               = useState('member');
  const [view, setView]               = useState('dashboard');
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Single toast slot for the whole app.
  const [toastNode, fireToast] = useToast();

  const handleLogin = (r, userId) => {
    setRole(r);
    setView('dashboard');
    setLoggedIn(true);
    if (r === 'member') setCurrentUserId(userId || 'M-1042');
    else if (r === 'trainer') setCurrentUserId(userId || 'T-01');
    else setCurrentUserId(null);
    // Reset bookings/notifications on each login for a clean session.
    setBookings(SESSIONS.filter(s => s.member === CURRENT[r].name).slice(0, 3));
    setNotifications(NOTIFICATIONS.map(n => ({...n})));
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setView('dashboard');
    setCurrentUserId(null);
  };

  const handleSwitchRole = (r) => {
    setRole(r);
    setView('dashboard');
    if (r === 'member') setCurrentUserId('M-1042');
    else if (r === 'trainer') setCurrentUserId('T-01');
    else setCurrentUserId(null);
  };

  const handleNav = (id) => {
    if (role === 'member' && id === 'notifications') {
      setShowNotifModal(true);
      return;
    }
    setView(id);
  };

  if (!loggedIn) {
    return <Landing onLogin={handleLogin} members={members} setMembers={setMembers} toast={fireToast} />;
  }

  const ViewComp = (VIEWS[role] && VIEWS[role][view]) || (() => <div className="empty-state">View not available.</div>);

  const unread = notifications.filter(n => n.unread).length;

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
