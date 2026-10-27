'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Landing from './landing';
import LoginPage from './LoginPage';
import { LoadingScreen } from './shared/LoadingScreen';
import AccountStatus from './auth/AccountStatus';
import { clearFormerAccountBrowserState } from './auth/browser-state';
import { PLANS, PROMOTIONS, TRAINERS } from './data';
import type { Plan } from './types';
import './auth/account-status.css';

export default function App({ initialLoginTab = 'login' }: { initialLoginTab?: 'login' | 'register' } = {}) {
  const { status, data: session } = useSession();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'authenticated') return <AccountStatus key={session?.user.id} />;
  return <PublicApp initialLoginTab={initialLoginTab} />;
}

function PublicApp({ initialLoginTab }: { initialLoginTab: 'login' | 'register' }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [plans, setPlans] = useState<Plan[]>(PLANS);
  useEffect(() => {
    let active = true;
    void clearFormerAccountBrowserState().then(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    fetch('/api/gym-plans').then(async response => {
      if (!response.ok) return;
      const result: unknown = await response.json();
      if (active && result && typeof result === 'object' && 'plans' in result && Array.isArray(result.plans)) setPlans(result.plans as Plan[]);
    }).catch((error: unknown) => console.error('Could not load the membership plan catalog.', error));
    return () => { active = false; };
  }, []);
  if (!ready) return <LoadingScreen />;
  if (pathname === '/login') return <LoginPage key={initialLoginTab} defaultTab={initialLoginTab} onBack={() => router.push('/')} />;
  return <Landing plans={plans} promotions={PROMOTIONS} trainers={TRAINERS} onNavigate={route => router.push(route)} />;
}
