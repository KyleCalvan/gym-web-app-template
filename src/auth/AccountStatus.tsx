'use client';

import { useEffect, useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import type { getAccountStatus } from './account';
import type { AccountNextStep } from './account-contract';

type Status = Omit<NonNullable<Awaited<ReturnType<typeof getAccountStatus>>>, 'roles' | 'profiles'>;

const STEP_LABELS: Record<AccountNextStep, string> = {
  'sign-in-with-google': 'Sign in with Google again to establish your Account. Your existing session has been retained.',
  'verify-email': 'Verify ownership of your email address.',
  'complete-profile': 'Complete your full name and contact phone.',
  'accept-terms': 'Read and accept the current terms.',
  'set-up-two-step-verification': 'Set up authenticator-app verification before using privileged interfaces.',
  'contact-support': 'Contact the gym for help with your Account.',
};

export default function AccountStatus({ initialStatus }: { initialStatus?: Status | null }) {
  const [status, setStatus] = useState<Status | null>(initialStatus ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/me', { cache: 'no-store' });
      if (!response.ok) throw new Error('Your Account status could not be loaded. Please retry.');
      setStatus(await response.json());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Your Account status could not be loaded.');
    } finally { setPending(false); }
  }

  useEffect(() => { if (!initialStatus) void refresh(); }, [initialStatus]);

  async function logout() {
    setPending(true);
    setError('');
    try {
      const result = await signOut({ redirect: false, callbackUrl: '/login' });
      if (!result?.url) throw new Error('Sign-out could not be confirmed. Please retry.');
      const session = await fetch('/api/auth/session', { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error('Sign-out could not be confirmed. Please retry.');
        return response.json();
      });
      if (session?.user) throw new Error('Your session is still active. Please retry sign-out.');
      window.location.assign('/login');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign-out could not be confirmed. Please retry.');
      setPending(false);
    }
  }

  async function continueWithGoogle() {
    setPending(true);
    setError('');
    try { await signIn('google', { callbackUrl: '/' }); }
    catch { setError('Google sign-in could not be started. Please retry.'); setPending(false); }
  }

  return (
    <main className="account-status" aria-busy={pending}>
      <p className="account-status-brand">VinAthletics</p>
      <h1>Your Account</h1>
      {pending && <p role="status">Loading Account status…</p>}
      {error && <p role="alert">{error}</p>}
      {status && <>
        <p>{status.account.name || 'Welcome'}</p>
        <p>{status.account.email}</p>
        <p>{status.account.emailVerified ? 'Email verified' : 'Email verification required'}</p>
        <p>Account {status.account.status}</p>
        {status.restricted ? <>
          <h2>Next steps</h2>
          <ul>{status.nextSteps.map((step) => <li key={step}>{STEP_LABELS[step]}</li>)}</ul>
          <p>Your sign-in is saved. Gym access is available once the required steps are complete.</p>
          <p>Profile, terms, and authenticator completion are not yet available here.</p>
        </> : <p>Your Account is ready. Your gym interfaces will appear here when available.</p>}
        <p>Creating an Account does not purchase a Membership.</p>
      </>}
      {status?.nextSteps.includes('sign-in-with-google') && <button type="button" disabled={pending} onClick={() => void continueWithGoogle()}>Continue with Google</button>}
      <div className="account-status-actions">
        <button type="button" onClick={() => void refresh()} disabled={pending}>Refresh status</button>
        <button type="button" onClick={() => void logout()} disabled={pending}>Sign out</button>
      </div>
    </main>
  );
}
