'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import type { getAccountStatus } from './account';
import type { AccountNextStep } from './account-contract';
import { CURRENT_TERMS_VERSION } from './terms';
import TermsOfUse from './TermsOfUse';
import { clearAccountBrowserState, establishAccountBrowserState } from './browser-state';

type Status = NonNullable<Awaited<ReturnType<typeof getAccountStatus>>>;
type VisibleStatus = Omit<Status, 'roles' | 'profiles'> & Partial<Pick<Status, 'roles' | 'profiles'>>;

const STEP_LABELS: Record<AccountNextStep, string> = {
  'sign-in-with-google': 'Sign in with Google again to establish your Account.',
  'verify-email': 'Verify ownership of your email address.',
  'complete-profile': 'Complete your full name and contact phone.',
  'accept-terms': 'Read and accept the current terms.',
  'complete-two-step-verification': 'Complete authenticator-app verification for this session.',
  'set-up-two-step-verification': 'Set up authenticator-app verification before using privileged interfaces.',
  'contact-support': 'Contact the gym for help with your Account.',
};

const ROLE_LABELS: Record<Status['roles'][number], string> = {
  member: 'Member', trainer: 'Trainer', staff: 'Staff', admin: 'Administrator', superadmin: 'Super Admin',
};

export default function AccountStatus({ initialStatus }: { initialStatus?: VisibleStatus | null }) {
  const [status, setStatus] = useState<VisibleStatus | null>(initialStatus ?? null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(initialStatus?.account.name ?? '');
  const [phone, setPhone] = useState(initialStatus?.account.phone ?? '');
  const [accepted, setAccepted] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Status['roles'][number] | null>(null);
  const seenAccountId = useRef(initialStatus?.account.id ?? null);

  useEffect(() => {
    if (status?.account.id) {
      if (seenAccountId.current !== status.account.id) {
        seenAccountId.current = status.account.id;
        setAccepted(false);
        setSelectedRole(null);
      }
      void establishAccountBrowserState(status.account.id);
      void fetch('/api/demo-session', { method: 'DELETE' }).catch(() => {});
    }
  }, [status?.account.id]);
  useEffect(() => { if (!initialStatus) void refresh(); }, [initialStatus]);

  async function run(task: () => Promise<void>) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError('');
    try { await task(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The request could not be completed. Please retry.'); }
    finally { pendingRef.current = false; setPending(false); }
  }

  async function refresh() {
    await run(async () => {
      const response = await fetch('/api/me', { cache: 'no-store' });
      if (!response.ok) throw new Error('Your Account status could not be loaded. Please retry.');
      const next: VisibleStatus = await response.json();
      setStatus(next);
      setName(next.account.name ?? '');
      setPhone(next.account.phone ?? '');
    });
  }

  async function submit(route: string, body: Record<string, unknown>) {
    await run(async () => {
      const response = await fetch(route, {
        method: route === '/api/me' ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'Your Account could not be updated. Please retry.');
      setStatus(result);
      if (route === '/api/me/terms') setAccepted(false);
    });
  }

  async function logout() {
    await run(async () => {
      const response = await fetch('/api/auth/signout', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callbackUrl: '/login' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'Sign-out could not be confirmed. Please retry.');
      await clearAccountBrowserState();
      setStatus(null);
      window.location.assign('/login');
    });
  }

  async function continueWithGoogle() {
    await run(async () => { await signIn('google', { callbackUrl: '/' }); });
  }

  const roles = status?.restricted ? [] : status?.roles ?? [];
  const activeRole = selectedRole && roles.includes(selectedRole) ? selectedRole : roles[0] ?? null;

  return <main className="account-status" aria-busy={pending}>
    <p className="account-status-brand">VinAthletics</p>
    <h1>Your Account</h1>
    {pending && <p role="status">Updating Account…</p>}
    {error && <p role="alert">{error}</p>}
    {status && <>
      <p>{status.account.name || 'Welcome'}</p>
      <p>Email: {status.account.email} <span>(read-only)</span></p>
      <p>{status.account.emailVerified ? 'Email verified' : 'Email verification required'}</p>
      <p>Account {status.account.status}</p>
      {status.restricted ? <>
        <h2>Next steps</h2>
        <ul>{status.nextSteps.map((step) => <li key={step}>{STEP_LABELS[step]}</li>)}</ul>
        {status.nextSteps.includes('complete-profile') && <form onSubmit={(event) => {
          event.preventDefault(); void submit('/api/me', { name, phone });
        }}>
          <h3>Complete your profile</h3>
          <label htmlFor="account-name">Full name</label>
          <input id="account-name" name="name" autoComplete="name" required minLength={2} maxLength={120}
            value={name} onChange={(event) => setName(event.target.value)} disabled={pending} />
          <label htmlFor="account-phone">Contact phone</label>
          <input id="account-phone" name="phone" type="tel" autoComplete="tel" required maxLength={25}
            value={phone} onChange={(event) => setPhone(event.target.value)} disabled={pending} />
          <p>Phone is used for contact only, not sign-in or verification.</p>
          <button type="submit" disabled={pending}>Save profile</button>
        </form>}
        {status.nextSteps.includes('accept-terms') && <section aria-labelledby="account-terms-heading">
          <h3 id="account-terms-heading">Terms of Use</h3>
          <div className="account-terms"><TermsOfUse /></div>
          <label className="account-agree"><input type="checkbox" checked={accepted} disabled={pending}
            onChange={(event) => setAccepted(event.target.checked)} />
            I have read and accept Terms of Use version {CURRENT_TERMS_VERSION}.</label>
          <button type="button" disabled={pending || !accepted}
            onClick={() => void submit('/api/me/terms', { version: CURRENT_TERMS_VERSION, accepted: true })}>Accept terms</button>
        </section>}
        <p>Your sign-in is saved. Gym access is available once every required step is complete.</p>
      </> : <section aria-labelledby="account-roles-heading">
        <h2 id="account-roles-heading">Your Assigned Roles</h2>
        <div className="account-role-selector" role="group" aria-label="Choose an Assigned Role">
          {roles.map((role) => <button type="button" key={role} disabled={pending}
            aria-pressed={activeRole === role} onClick={() => setSelectedRole(role)}>{ROLE_LABELS[role]}</button>)}
        </div>
        {activeRole && <div className="account-interface" role="region" aria-label={`${ROLE_LABELS[activeRole]} interface`}>
          <h3>{ROLE_LABELS[activeRole]}</h3>
          <p>Your {ROLE_LABELS[activeRole].toLowerCase()} profile is connected to this Account.</p>
          <p>Personal records and operations for this interface are unavailable while integration is being completed.</p>
          {activeRole === 'member' && <p>Membership information is unavailable here.</p>}
        </div>}
      </section>}
      <p>Creating an Account does not purchase a Membership.</p>
    </>}
    {status?.nextSteps.includes('sign-in-with-google') && <button type="button" disabled={pending}
      onClick={() => void continueWithGoogle()}>Continue with Google</button>}
    <div className="account-status-actions">
      <button type="button" onClick={() => void refresh()} disabled={pending}>Refresh status</button>
      <button type="button" onClick={() => void logout()} disabled={pending}>Sign out</button>
    </div>
  </main>;
}
