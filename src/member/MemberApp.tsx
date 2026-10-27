'use client';

import { useEffect, useRef, useState } from 'react';
import Sidebar from '../shared/shell/Sidebar';
import { Topbar } from '../shared/shell/Topbar';
import { ProfileMenu } from '../shared/shell/ProfileMenu';
import { useToast } from '../shared/hooks/useToast';
import type { Member, Notification, NotifPrefs, Plan, Session, Trainer, TrainerAvailability, Transaction, ViewProps } from '../types';
import MemberDashboard from './MemberDashboard';
import { MEMBER_NAV, MEMBER_VIEWS } from './index';

type Overview = {
  joinedAt: string;
  membership: { planName: string; status: string; endsAt: string; cancellationScheduled: boolean } | null;
  latestPayment: { amount: number; status: string; at: string } | null;
  studentVerificationStatus: string | null;
  upcomingSessions: { id: string; startsAt: string; type: string; status: string; trainer: string | null }[];
};

function sessionDate(value: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export default function MemberApp({ name, email, phone, profileId, onLogout, pending }: {
  name: string; email: string; phone: string; profileId: string; onLogout: () => void; pending: boolean;
}) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainerAvailability, setTrainerAvailability] = useState<TrainerAvailability[]>([]);
  const [bookingSlots, setBookingSlots] = useState<NonNullable<ViewProps['bookingSlots']>>([]);
  const [error, setError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [view, setView] = useState('dashboard');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({ email: true, sms: false, reminders: true, promos: false });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  });
  const [toastNode, fireToast] = useToast();
  const pillRef = useRef<HTMLButtonElement>(null);

  function refresh() {
    setError('');
    fetch('/api/member/overview', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Your member overview could not be loaded.');
        return response.json() as Promise<Overview>;
      })
      .then(setOverview)
      .catch(() => setError('Your member overview could not be loaded. Please refresh.'));
  }

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('checkout');
    const reference = params.get('reference');
    if (!result || !reference) return;
    const coaching = reference.startsWith('COACH-');
    setView(coaching ? 'coaching' : 'membership');
    if (result === 'cancelled') {
      window.history.replaceState(null, '', '/account');
      if (coaching) {
        void cancelCoachingCheckout(reference).then(status => {
          fireToast(status === 'Paid' ? 'Test payment confirmed. Your coaching sessions are booked.'
            : status === 'Pending' ? 'Payment is still processing. Check its status before leaving.'
              : 'Checkout was not completed. No coaching session was booked.');
          if (status !== 'Pending' && window.opener) window.close();
        }).catch(error => fireToast(error instanceof Error ? error.message : 'Checkout could not be cancelled.'));
      } else {
        fireToast('Checkout was not completed. Your membership has not changed.');
      }
      return;
    }
    let cancelled = false;
    async function verify() {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        try {
          const endpoint = coaching ? '/api/member/coaching-checkout/status' : '/api/member/checkout/status';
          const response = await fetch(`${endpoint}?reference=${encodeURIComponent(reference!)}`, { cache: 'no-store' });
          const data: { status?: string; error?: string } = await response.json();
          if (cancelled) return;
          if (!response.ok) throw new Error(data.error || 'Payment could not be verified.');
          if (data.status === 'Paid') {
            window.history.replaceState(null, '', '/account');
            refresh();
            fireToast(coaching ? 'Test payment confirmed. Your coaching sessions are booked.'
              : 'Test payment confirmed. Your membership is active.');
            if (coaching && window.opener) window.close();
            return;
          }
          if (data.status === 'Failed') {
            fireToast(coaching ? 'Checkout failed. No coaching session was booked.'
              : 'Checkout failed. Your membership has not changed.');
            return;
          }
        } catch (error) {
          if (attempt === 4) {
            fireToast(error instanceof Error ? error.message : 'Payment could not be verified.');
            return;
          }
        }
        if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 2000));
      }
      if (!cancelled) fireToast('Payment is still pending. Refresh this page to check again.');
    }
    void verify();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    let active = true;
    fetch('/api/gym-plans').then(async response => {
      if (!response.ok) return;
      const result: { plans?: Plan[] } = await response.json();
      if (active && Array.isArray(result.plans)) setPlans(result.plans);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (view !== 'coaching') return;
    let active = true;
    fetch('/api/member/coaching-options', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Coaching schedules could not be loaded.');
      return response.json() as Promise<{ trainers: Trainer[]; trainerAvailability: TrainerAvailability[]; bookingSlots: NonNullable<ViewProps['bookingSlots']> }>;
    }).then(result => {
      if (!active) return;
      setTrainers(result.trainers);
      setTrainerAvailability(result.trainerAvailability);
      setBookingSlots(result.bookingSlots);
    }).catch(() => { if (active) fireToast('Coaching schedules could not be loaded. Please try again.'); });
    return () => { active = false; };
  }, [view]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('vinathletics-theme', theme); } catch { /* Theme remains active for this visit. */ }
  }, [theme]);

  function handleNav(nextView: string) {
    setView(nextView);
    setProfileOpen(false);
    setNotificationsOpen(false);
    setIsSidebarOpen(false);
  }

  async function startPlanCheckout(planName: string) {
    const response = await fetch('/api/member/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planName }),
    });
    const data: { checkoutUrl?: string; error?: string } = await response.json();
    if (!response.ok || !data.checkoutUrl) throw new Error(data.error || 'Checkout could not start.');
    window.location.assign(data.checkoutUrl);
  }

  async function startCoachingCheckout(selection: { trainerId: string; dates: string[]; time: string; expectedTotal: number }) {
    const response = await fetch('/api/member/coaching-checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selection),
    });
    const data: { checkoutUrl?: string; reference?: string; error?: string } = await response.json();
    if (!response.ok || !data.checkoutUrl || !data.reference) throw new Error(data.error || 'Coaching checkout could not start.');
    return { checkoutUrl: data.checkoutUrl, reference: data.reference };
  }

  async function checkCoachingCheckout(reference: string): Promise<'Pending' | 'Paid' | 'Failed'> {
    const response = await fetch(`/api/member/coaching-checkout/status?reference=${encodeURIComponent(reference)}`, { cache: 'no-store' });
    const data: { status?: 'Pending' | 'Paid' | 'Failed'; error?: string } = await response.json();
    if (!response.ok || !data.status) throw new Error(data.error || 'Payment status could not be verified.');
    if (data.status === 'Paid') {
      refresh();
      void fetch('/api/member/coaching-options', { cache: 'no-store' }).then(async result => {
        if (!result.ok) return;
        const options: { trainers: Trainer[]; trainerAvailability: TrainerAvailability[];
          bookingSlots: NonNullable<ViewProps['bookingSlots']> } = await result.json();
        setTrainers(options.trainers);
        setTrainerAvailability(options.trainerAvailability);
        setBookingSlots(options.bookingSlots);
      }).catch(() => {});
    }
    return data.status;
  }

  async function cancelCoachingCheckout(reference: string): Promise<'Pending' | 'Paid' | 'Failed'> {
    const response = await fetch('/api/member/coaching-checkout/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference }),
    });
    const data: { status?: 'Pending' | 'Paid' | 'Failed'; error?: string } = await response.json();
    if (!response.ok || !data.status) throw new Error(data.error || 'Checkout could not be cancelled.');
    if (data.status === 'Paid') refresh();
    return data.status;
  }

  async function cancelPlan(reason: string) {
    const response = await fetch('/api/member/membership/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const data: { membership?: Overview['membership']; error?: string } = await response.json();
    if (!response.ok || !data.membership) throw new Error(data.error || 'Plan cancellation could not be saved.');
    setOverview(previous => previous ? { ...previous, membership: data.membership! } : previous);
  }

  const user = { id: profileId, name, role: 'Member' };
  const member = {
    id: profileId, name, email, phone,
    joined: overview?.joinedAt ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(overview.joinedAt)) : '',
    plan: overview?.membership?.planName ?? '',
    status: overview?.membership?.status ?? '',
    membershipValidUntil: overview?.membership?.endsAt ?? null,
    membershipCancellationScheduled: overview?.membership?.cancellationScheduled ?? false,
  };
  const sessions = overview?.upcomingSessions.map(session => ({
    id: session.id, member: name, trainer: session.trainer ?? 'Trainer to be assigned',
    date: sessionDate(session.startsAt),
    time: new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', timeStyle: 'short' }).format(new Date(session.startsAt)),
    type: session.type, status: session.status,
  })) ?? [];
  const transactions = overview?.latestPayment ? [{
    id: 'latest-payment', member: name, type: 'Payment', amount: overview.latestPayment.amount,
    status: overview.latestPayment.status, method: 'Not recorded',
    date: new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(overview.latestPayment.at)),
  }] : [];

  const ViewComp = MEMBER_VIEWS[view];
  const ignoreChange = () => {};
  const viewProps: ViewProps = {
    role: 'member', currentUser: user, currentUserId: member.id, onNav: handleNav,
    members: [member as Member], setMembers: ignoreChange,
    trainers, setTrainers: ignoreChange,
    plans, setPlans: ignoreChange,
    transactions: transactions as Transaction[], setTransactions: ignoreChange,
    sessions: sessions as Session[], setSessions: ignoreChange,
    trainerAvailability, setTrainerAvailability: ignoreChange, bookingSlots,
    promotions: [], setPromotions: ignoreChange,
    staff: [], setStaff: ignoreChange, admins: [], setAdmins: ignoreChange,
    superadmins: [], setSuperadmins: ignoreChange,
    notifications, setNotifications, bookings: sessions as Session[], setBookings: ignoreChange,
    checkIns: { count: 0, today: '' }, setCheckIns: ignoreChange,
    checkInHistory: [], setCheckInHistory: ignoreChange,
    notifPrefs, setNotifPrefs, auditLog: [], setAuditLog: ignoreChange,
    activeSessions: [], setActiveSessions: ignoreChange, currentSessionId: null,
    toast: fireToast, today: '', addAudit: () => {},
    promotionRedemptions: [], setPromotionRedemptions: ignoreChange,
    preferredPaymentMethod: 'GCash', setPreferredPaymentMethod: ignoreChange,
    qrDestinations: [], setQrDestinations: ignoreChange,
    onDeleteAccount: ignoreChange, emptyDefaults: true, onPlanCheckout: startPlanCheckout,
    onPlanCancel: cancelPlan,
    onCoachingCheckout: startCoachingCheckout,
    onCoachingCheckoutStatus: checkCoachingCheckout,
    onCoachingCheckoutCancel: cancelCoachingCheckout,
    studentVerified: overview?.studentVerificationStatus === 'Verified',
  };

  return <div className="app-shell" aria-busy={pending}>
    <Sidebar role="member" brand="VinAthletics" user={user} nav={MEMBER_NAV} active={view}
      onNav={handleNav} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
    <div className="app-main" style={{ flex: 1, minWidth: 0 }}>
      <Topbar role="member" user={user} view={view} nav={MEMBER_NAV}
        onNav={handleNav} toggleSidebar={() => setIsSidebarOpen(open => !open)}
        onProfileMenu={() => { setNotificationsOpen(false); setProfileOpen(open => !open); }} pillRef={pillRef}
        profileMenuOpen={profileOpen} notifications={notifications} setNotifications={setNotifications}
        notificationsOpen={notificationsOpen} onToggleNotifications={() => { setProfileOpen(false); setNotificationsOpen(open => !open); }}
        onCloseNotifications={() => setNotificationsOpen(false)} toast={fireToast} />
      <div className="content">
        {view === 'dashboard' && error && <p role="alert">{error} <button type="button" onClick={refresh}>Retry</button></p>}
        {view === 'dashboard' && !overview && !error && <p role="status">Loading your member dashboard…</p>}
        {view === 'dashboard' && overview && <MemberDashboard members={[member]} currentUserId={member.id}
          sessions={sessions} bookings={sessions} transactions={transactions}
          trainers={[]} trainerAvailability={[]} bookingSlots={[]} plans={[]} promotions={[]} promotionRedemptions={[]}
          setSessions={() => {}} setBookings={() => {}} setTransactions={() => {}}
          setPromotions={() => {}} setPromotionRedemptions={() => {}}
          onNav={handleNav} onBook={() => fireToast('Online booking is not available yet.')}
          paymentKnown={false} promotionsAvailable={false}
          toast={fireToast} today={''} addAudit={() => {}} preferredPaymentMethod={''} />}
        {view !== 'dashboard' && ViewComp && <ViewComp {...viewProps} />}
      </div>
    </div>
    <ProfileMenu role="member" availableRoles={['member']} onSwitchRole={() => {}}
      user={user} open={profileOpen} onClose={() => setProfileOpen(false)}
      onProfile={() => handleNav('profile')} onLogout={onLogout}
      notifPrefs={notifPrefs} setNotifPrefs={setNotifPrefs} theme={theme}
      onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
      triggerRef={pillRef} />
    {toastNode}
  </div>;
}
