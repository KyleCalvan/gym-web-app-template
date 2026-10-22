import { cookies } from 'next/headers';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import AccountStatus from '@/src/auth/AccountStatus';
import { accountProjection } from '@/src/auth/completion';
import '@/src/auth/account-status.css';

export default async function AccountPage() {
  const status = (await readSession(requestSessionToken({ cookies: await cookies() })))?.status;
  if (!status) return <main className="account-status"><h1>Your Account</h1><a href="/login">Sign in to continue</a></main>;
  return <AccountStatus initialStatus={accountProjection(status)} />;
}
