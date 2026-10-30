'use client';

import { useState } from 'react';
import AuthenticatedShell from '../auth/AuthenticatedShell';
import { MEMBER_NAV } from './index';
import MemberAccountProfile from './MemberAccountProfile';
import type { AccountNextStep } from '../auth/account-contract';

export type PortalData = {
  memberId: string;
  displayMemberId: string;
  joinedAt: string;
  phone: string;
  emergencyContact: string;
  avatarUrl?: string;
  name: string;
  email: string;
  emailVerified: boolean;
  membership: { planName: string; status: string; endsAt: string } | null;
  sessions: { id: string; startsAt: string; type: string; status: string; trainer: string }[];
  payments: { id: string; type: string; amount: number; status: string; createdAt: string }[];
  promotions: { id: string; title: string; description: string | null; code: string; validUntil: string }[];
  links: { id: string; label: string; url: string }[];
};

const date = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeZone: 'Asia/Manila',
}).format(new Date(value));
const dateTime = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
}).format(new Date(value));
const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

export default function MemberPortal({ data, setupSteps = [] }: { data: PortalData; setupSteps?: AccountNextStep[] }) {
  const [view, setView] = useState('dashboard');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const upcoming = data.sessions.filter((item) => item.status !== 'Cancelled' && new Date(item.startsAt) >= new Date())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const navigate = (next: string) => setView(next);
  async function resendVerification() {
    setPending(true); setNotice('');
    try {
      const response = await fetch('/api/verify-email/resend', { method: 'POST' });
      const result: { message?: string } = await response.json();
      setNotice(result.message ?? (response.ok ? 'Verification email sent.' : 'Could not send verification email.'));
    } catch { setNotice('Could not send verification email. Please retry.'); }
    finally { setPending(false); }
  }
  return <AuthenticatedShell role="member" roles={['member']} user={{ name: data.name, avatarUrl: data.avatarUrl }}
    nav={MEMBER_NAV} view={view} onNav={navigate} onSwitchRole={() => {}} setupSteps={setupSteps}>
      <div className="member-portal">
        {!data.emailVerified && <div className="member-portal-verify" role="status">
          <div><strong>Verify your email</strong><span>Your member dashboard is ready. Verify your address to complete your account.</span></div>
          <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => void resendVerification()}>Resend email</button>
        </div>}
        {notice && <p className="member-portal-notice" role="status">{notice}</p>}
        {view === 'dashboard' && <>
          <section className="member-dashboard-summary card" aria-labelledby="member-dashboard-heading">
            <div className="member-dashboard-intro"><h2 id="member-dashboard-heading">Welcome back, {data.name.split(' ')[0]}</h2><p>Your membership, sessions, and payments at a glance.</p></div>
            <div className="member-dashboard-membership">
              <div className="member-dashboard-plan"><span className="member-summary-label">Current plan</span><strong>{data.membership?.planName ?? 'No plan selected'}</strong>{data.membership && <span>{data.membership.status}</span>}</div>
              <div className="member-summary-detail"><span className="member-summary-label">Validity</span><strong>{data.membership ? date(data.membership.endsAt) : 'No membership yet'}</strong></div>
              <div className="member-summary-detail"><span className="member-summary-label">Latest payment</span><strong>{data.payments[0] ? money(data.payments[0].amount) : 'No payment recorded'}</strong>{data.payments[0] && <span>{data.payments[0].status}</span>}</div>
            </div>
          </section>
          <div className="grid grid-2-1 member-dashboard-main-grid">
            <section className="card"><div className="card-head"><h2>Upcoming Sessions</h2></div>
              {upcoming.length ? <ul className="member-portal-list">{upcoming.slice(0, 4).map((item) => <li key={item.id}><strong>{item.type}</strong><span>{dateTime(item.startsAt)} · {item.trainer}</span><small>{item.status}</small></li>)}</ul>
                : <p className="member-dashboard-empty">No upcoming sessions.</p>}
            </section>
            <section className="card"><div className="card-head"><h2>Quick Actions</h2></div><div className="member-dashboard-actions">
              <button type="button" className="btn btn-outline btn-block" onClick={() => navigate('membership')}>View Membership</button>
              <button type="button" className="btn btn-outline btn-block" onClick={() => navigate('coaching')}>View Coaching Sessions</button>
              <button type="button" className="btn btn-outline btn-block" onClick={() => navigate('payments')}>View Payments</button>
              <button type="button" className="btn btn-outline btn-block" onClick={() => navigate('promotions')}>Browse Promotions</button>
            </div></section>
          </div>
          <section className="card member-portal-section"><div className="card-head"><h2>Current Promotions</h2></div>
            {data.promotions.length ? <ul className="member-portal-list">{data.promotions.slice(0, 2).map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.description ?? item.code}</span><small>Until {date(item.validUntil)}</small></li>)}</ul>
              : <p className="member-dashboard-empty">No active promotions are available.</p>}
          </section>
        </>}
        {view === 'membership' && <section className="card member-portal-section"><div className="card-head"><h2>Membership</h2></div>
          {data.membership ? <dl className="member-portal-details"><div><dt>Plan</dt><dd>{data.membership.planName}</dd></div><div><dt>Status</dt><dd>{data.membership.status}</dd></div><div><dt>Valid through</dt><dd>{date(data.membership.endsAt)}</dd></div></dl>
            : <p className="member-dashboard-empty">No membership has been recorded for your account.</p>}
        </section>}
        {(view === 'coaching' || view === 'activity') && <section className="card member-portal-section"><div className="card-head"><h2>{view === 'coaching' ? 'Coaching Sessions' : 'Activity'}</h2></div>
          {data.sessions.length ? <ul className="member-portal-list">{data.sessions.map((item) => <li key={item.id}><strong>{item.type}</strong><span>{dateTime(item.startsAt)} · {item.trainer}</span><small>{item.status}</small></li>)}</ul>
            : <p className="member-dashboard-empty">No coaching sessions have been recorded yet.</p>}
        </section>}
        {view === 'payments' && <section className="card member-portal-section"><div className="card-head"><h2>My Payments</h2></div>
          {data.payments.length ? <ul className="member-portal-list">{data.payments.map((item) => <li key={item.id}><strong>{item.type} · {money(item.amount)}</strong><span>{date(item.createdAt)}</span><small>{item.status}</small></li>)}</ul>
            : <p className="member-dashboard-empty">No payments have been recorded yet.</p>}
        </section>}
        {view === 'promotions' && <section className="card member-portal-section"><div className="card-head"><h2>Promotions</h2></div>
          {data.promotions.length ? <ul className="member-portal-list">{data.promotions.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.description ?? item.code}</span><small>Until {date(item.validUntil)}</small></li>)}</ul>
            : <p className="member-dashboard-empty">No active promotions are available.</p>}
        </section>}
        {view === 'profile' && <MemberAccountProfile data={data} />}
        {view === 'chat' && <section className="card member-portal-section"><div className="card-head"><h2>Gym Links & QR</h2></div>
          {data.links.length ? <ul className="member-portal-list">{data.links.filter((item) => /^https?:\/\//i.test(item.url)).map((item) => <li key={item.id}><a href={item.url} target="_blank" rel="noreferrer">{item.label}</a></li>)}</ul>
            : <p className="member-dashboard-empty">No gym links have been configured yet.</p>}
        </section>}
      </div>
  </AuthenticatedShell>;
}
