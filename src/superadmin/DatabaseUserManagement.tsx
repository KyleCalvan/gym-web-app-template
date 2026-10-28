'use client';

import { useEffect, useState } from 'react';
import type { Admin, Member, Plan, Staff, Trainer } from '../types';
import AdminQrDestinations from '../admin/AdminQrDestinations';
import SuperAdminUsers from './SuperAdminUsers';
import SuperAdminTrash from './SuperAdminTrash';

export default function DatabaseUserManagement({ toast }: { toast: (message: string) => void }) {
  const [view, setView] = useState<'users' | 'archive' | 'qr'>('users');
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/gym-plans', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Plans could not be loaded.');
      const result = await response.json();
      if (active) setPlans(result.plans ?? []);
    }).catch(error => { if (active) toast(error.message); });
    return () => { active = false; };
  }, [toast]);

  const props = { admins, setAdmins, members, setMembers, trainers, setTrainers,
    staff, setStaff, plans, toast, databaseMode: true };

  return <section aria-label="Super Admin management">
    <div className="account-trainer-views" role="group" aria-label="Super Admin views">
      <button type="button" aria-pressed={view === 'users'} onClick={() => setView('users')}>User Management</button>
      <button type="button" aria-pressed={view === 'archive'} onClick={() => setView('archive')}>Archive</button>
      <button type="button" aria-pressed={view === 'qr'} onClick={() => setView('qr')}>Gym QR Links</button>
    </div>
    {view === 'users' ? <SuperAdminUsers {...props} />
      : view === 'archive' ? <SuperAdminTrash {...props} />
        : <AdminQrDestinations databaseMode toast={toast} />}
  </section>;
}
