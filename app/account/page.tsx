import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/auth/options';
import { getAccountStatus } from '@/src/auth/account';
import AccountStatus from '@/src/auth/AccountStatus';
import '@/src/auth/account-status.css';

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const status = session?.user?.id ? await getAccountStatus(session.user.id) : null;
  if (!status) return <main className="account-status"><h1>Your Account</h1><a href="/login">Sign in to continue</a></main>;
  const { roles, profiles, ...limited } = status;
  return <AccountStatus initialStatus={limited} />;
}
