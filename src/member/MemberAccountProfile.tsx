'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Field, Modal, TabbedCard, TextInput } from '../shared';
import ProfileSettingsPanel from '../shared/ProfileSettingsPanel';
import type { NotifPrefs } from '../types';
import type { PortalData } from './MemberPortal';

export default function MemberAccountProfile({ data }: { data: PortalData }) {
  const router = useRouter();
  const [name, setName] = useState(data.name);
  const [phone, setPhone] = useState(data.phone);
  const [emergency, setEmergency] = useState(data.emergencyContact);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [securityOpen, setSecurityOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({ email: true, sms: false, reminders: true, promos: false });

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setNotice('');
    try {
      const response = await fetch('/api/me', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), emergencyContact: emergency.trim() }),
      });
      const result: { message?: string } = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'Could not save your profile.');
      setNotice('Profile updated.');
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save your profile.'); }
    finally { setPending(false); }
  }

  return <div className="grid grid-1-2 profile-page-grid">
    <TabbedCard title={data.name}>
      <div className="profile-photo-content">
        <Avatar src={data.avatarUrl} name={data.name} size={96} />
        <div><button type="button" className="btn btn-outline btn-sm"
          onClick={() => setNotice('Photo uploads are not available for this account yet.')}>Change Photo</button></div>
      </div>
      {data.membership?.status === 'Frozen' && <div style={{ padding: '8px 10px', background: 'var(--paper)', border: '1.5px solid var(--amber)', borderRadius: 'var(--radius)', fontSize: 13.2, color: 'var(--steel)', marginBottom: 10 }}>
        <Badge status="Frozen" /> &nbsp;Account frozen — admin must unfreeze to resume activity.
      </div>}
    </TabbedCard>
    <div>
      {notice && <p className="member-portal-notice" role="status">{notice}</p>}
      <ProfileSettingsPanel
        account={<div className="profile-settings-account-grid">
          <div className="profile-settings-account-item"><div className="eyebrow">Member ID</div><p className="mono">{data.memberId}</p></div>
          <div className="profile-settings-account-item"><div className="eyebrow">Plan</div><p>{data.membership?.planName ?? '—'}</p></div>
          <div className="profile-settings-account-item"><div className="eyebrow">Member Since</div><p className="mono">{new Date(data.joinedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</p></div>
          <div className="profile-settings-account-item"><div className="eyebrow">Account Status</div><p>Active</p></div>
        </div>}
        profile={<form onSubmit={(event) => void save(event)}>
          <div className="grid grid-2">
            <Field label="Full Name"><TextInput required value={name} onChange={setName} disabled={pending} /></Field>
            <Field label="Email"><TextInput type="email" required value={data.email} onChange={() => {}} readOnly /></Field>
            <Field label="Phone"><TextInput type="tel" value={phone} onChange={setPhone} disabled={pending} /></Field>
            <Field label="Emergency Contact"><TextInput type="tel" placeholder="+63 9XX XXX XXXX" value={emergency} onChange={setEmergency} disabled={pending} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}><button className="btn btn-signal btn-sm" type="submit" style={{ width: 'auto' }} disabled={pending}>{pending ? 'Saving…' : 'Save Changes'}</button></div>
        </form>}
        onOpenSecurity={() => setSecurityOpen(true)}
        notifPrefs={notifPrefs}
        setNotifPrefs={setNotifPrefs}
        deleteAccount={<>
          <h2>Delete Account</h2>
          <p className="profile-delete-warning"><strong>This action is permanent.</strong> You will lose access to this account and your membership profile will be removed from the gym app. Any financial or audit records that must be retained under the gym&apos;s operating or legal retention rules may remain. You would need to register again to use the app.</p>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteOpen(true)}>Delete Account</button>
        </>}
      />
    </div>
    {securityOpen && <Modal title="Security Settings" onClose={() => setSecurityOpen(false)}>
      <div style={{ padding: '0 24px 24px' }}><p>Password and two-step settings are not available for this database account yet.</p></div>
    </Modal>}
    {deleteOpen && <Modal title="Confirm Account Deletion" onClose={() => setDeleteOpen(false)}>
      <div style={{ padding: '0 24px 24px' }}><p>Account deletion is not available here yet. Please contact the gym to request it.</p></div>
    </Modal>}
  </div>;
}
