'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import type { getAccountStatus } from './account';
import type { AccountNextStep } from './account-contract';
import { CURRENT_TERMS_VERSION } from './terms';
import TermsOfUse from './TermsOfUse';
import { NameFields } from '../shared/components/NameFields';
import { splitName, formatName } from '../shared/nameParts';
import { LoadingScreen } from '../shared/LoadingScreen';
import MemberApp from '../member/MemberApp';
import { clearAccountBrowserState, establishAccountBrowserState } from './browser-state';
import { TwoFactorChallenge } from '../shared/components/TwoFactorChallenge';

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
  member: 'Member', trainer: 'Trainer', staff: 'Staff', admin: 'Manager', superadmin: 'Super Admin',
};

export default function AccountStatus({ initialStatus }: { initialStatus?: VisibleStatus | null }) {
  const [status, setStatus] = useState<VisibleStatus | null>(initialStatus ?? null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profileName, setProfileName] = useState(() => splitName(initialStatus?.account.name ?? ''));
  const [phone, setPhone] = useState(initialStatus?.account.phone ?? '');
  const [accepted, setAccepted] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Status['roles'][number] | null>(null);
  const [authenticatorMode, setAuthenticatorMode] = useState<'setup' | 'challenge' | null>(null);
  const seenAccountId = useRef(initialStatus?.account.id ?? null);

  useEffect(() => {
    if (status?.account.id) {
      if (seenAccountId.current !== status.account.id) {
        seenAccountId.current = status.account.id;
        setAccepted(false);
        setSelectedRole(null);
      }
      void establishAccountBrowserState(status.account.id);
    }
  }, [status?.account.id]);
  useEffect(() => { if (!initialStatus) void refresh(); }, [initialStatus]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('check-email') === '1') setNotice('Check your inbox for a verification link before entering the member dashboard.');
    else if (params.get('delivery') === 'failed') setNotice('Your account was created, but the verification email could not be sent. Try resending it below.');
    else if (params.has('verification')) setNotice('That verification link is invalid or expired. Request a new one below.');
  }, []);

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
      setProfileName(splitName(next.account.name ?? ''));
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
    await run(async () => { await signIn('google', { callbackUrl: '/account' }); });
  }

  async function resendVerification() {
    await run(async () => {
      const response = await fetch('/api/verify-email/resend', { method: 'POST' });
      const result: { message?: string } = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'The verification email could not be sent.');
      setNotice(result.message ?? 'A new verification link has been sent.');
    });
  }

  async function prepareAuthenticator() {
    const response = await fetch('/api/mfa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const result: { secret?: string; message?: string } = await response.json();
    if (!response.ok || !result.secret) throw new Error(result.message ?? 'Could not prepare two-step verification.');
    return result.secret;
  }

  async function verifyAuthenticator(code: string) {
    const response = await fetch('/api/mfa', { method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: authenticatorMode, code }) });
    const result: { message?: string } = await response.json();
    if (!response.ok) throw new Error(result.message ?? 'Could not verify the authenticator code.');
    return true;
  }

  const roles = status?.restricted ? [] : status?.roles ?? [];
  const activeRole = selectedRole && roles.includes(selectedRole) ? selectedRole : roles[0] ?? null;
  const memberDashboard = Boolean(status && !status.restricted && roles.length === 1 && roles[0] === 'member');

  if (!status && !error) return <LoadingScreen label="Loading your account" />;
  if (status && memberDashboard) return <MemberApp name={status.account.name ?? 'Member'}
    email={status.account.email ?? ''} phone={status.account.phone ?? ''}
    profileId={status.profiles?.find(profile => profile.role === 'member')?.profileId ?? status.account.id}
    onLogout={() => void logout()} pending={pending} />;

  return <main className="account-status" aria-busy={pending}>
    <p className="account-status-brand">VinAthletics</p>
    <h1>Your Account</h1>
    {pending && <p role="status">Updating Account…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {status && <>
      <p>{status.account.name || 'Welcome'}</p>
      <p>Email: {status.account.email} <span>(read-only)</span></p>
      <p>{status.account.emailVerified ? 'Email verified' : 'Email verification required'}</p>
      <p>Account {status.account.status}</p>
      {status.restricted ? <>
        <h2>Next steps</h2>
        <ul>{status.nextSteps.map((step) => <li key={step}>{STEP_LABELS[step]}</li>)}</ul>
        {status.nextSteps.includes('verify-email') && <button type="button" disabled={pending}
          onClick={() => void resendVerification()}>Resend verification email</button>}
        {status.nextSteps.includes('complete-two-step-verification') && <button type="button" disabled={pending}
          onClick={() => setAuthenticatorMode('challenge')}>Verify authenticator</button>}
        {status.nextSteps.includes('set-up-two-step-verification') && <button type="button" disabled={pending}
          onClick={() => setAuthenticatorMode('setup')}>Set up authenticator</button>}
        {status.nextSteps.includes('complete-profile') && <form onSubmit={(event) => {
          event.preventDefault();
          const name = formatName(profileName);
          if (name.length > 120) { setError('Keep your full name within 120 characters.'); return; }
          void submit('/api/me', { name, phone });
        }}>
          <h3>Complete your profile</h3>
          <NameFields prefix="account" value={profileName} onChange={setProfileName} disabled={pending} />
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
    {authenticatorMode && status?.nextSteps.includes(authenticatorMode === 'setup'
      ? 'set-up-two-step-verification' : 'complete-two-step-verification') && <TwoFactorChallenge
      mode={authenticatorMode} email={status.account.email ?? ''} onCancel={() => setAuthenticatorMode(null)}
      onSendCode={authenticatorMode === 'setup' ? prepareAuthenticator : undefined}
      onVerifyCode={verifyAuthenticator} onVerified={() => window.location.assign('/account')} />}
  </main>;
}
