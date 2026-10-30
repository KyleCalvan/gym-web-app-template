import { useState } from 'react';
import { Avatar, TabbedCard, Field, TextInput } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';
import { SecurityFlow } from '../shared/components/SecurityFlow';
import ProfileSettingsPanel from '../shared/ProfileSettingsPanel';
import type { ViewProps } from '../types.ts';

function SuperAdminProfile({ superadmins, currentUserId, toast, notifPrefs, setNotifPrefs, currentUser, onSuperAdminAction }: ViewProps) {
  const me = superadmins.find(s => s.id === currentUserId) || superadmins[0];
  const [info, setInfo] = useState({
    name: me?.name || currentUser?.name || '',
    email: me?.email || '',
    phone: me?.phone || '',
    phoneSecondary: me?.phoneSecondary || '',
  });

  const [showSecurityFlow, setShowSecurityFlow] = useState(false);

  const submitInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await onSuperAdminAction?.('profile.update', info); toast('Profile updated'); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not update profile'); }
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onPickImage(file, url => {
      void onSuperAdminAction?.('profile.update', { ...info, avatarUrl: url })
        .then(() => toast('Photo updated'))
        .catch(error => toast(error instanceof Error ? error.message : 'Could not update photo'));
    }, msg => toast(msg));
    e.target.value = '';
  };

  return (
    <div className="grid grid-1-2 profile-page-grid">
      <TabbedCard title={me?.name || currentUser?.name || 'Super Admin'}>
        <div className="profile-photo-content">
          <Avatar src={me?.avatarUrl || currentUser?.avatarUrl} name={me?.name || currentUser?.name || 'Super Admin'} size={96} />
          <div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => document.getElementById('superadmin-avatar-input')?.click()}
            >
              Change Photo
            </button>
            <input
              id="superadmin-avatar-input"
              type="file"
              accept="image/*"
              style={{display:'none'}}
              onChange={handleAvatarFile}
            />
          </div>
        </div>
      </TabbedCard>
      <div>
        <ProfileSettingsPanel
          account={
            <div className="profile-settings-account-grid">
              <div className="profile-settings-account-item"><div className="eyebrow">Super Admin ID</div><p className="mono">{me?.displayId || me?.id || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Role</div><p>Super Administrator</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Super Admin Since</div><p className="mono">{me?.createdAt || '—'}</p></div>
            </div>
          }
          profile={
          <form onSubmit={submitInfo}>
            <div className="grid grid-2">
              <Field label="Full Name"><TextInput required value={info.name} onChange={v=>setInfo(i=>({...i, name:v}))} /></Field>
              <Field label="Email"><TextInput type="email" required value={info.email} onChange={v=>setInfo(i=>({...i, email:v}))} /></Field>
              <Field label="Phone"><TextInput value={info.phone} onChange={v=>setInfo(i=>({...i, phone:v}))} /></Field>
              <Field label="Phone (Secondary)"><TextInput value={info.phoneSecondary || ''} onChange={v=>setInfo(i=>({...i, phoneSecondary:v}))} /></Field>
            </div>
            <div style={{display:'flex', gap:12, marginTop:12}}>
              <button className="btn btn-signal btn-sm" type="submit" style={{width: 'auto'}}>Save Changes</button>
            </div>
          </form>
          }
          onOpenSecurity={() => setShowSecurityFlow(true)}
          notifPrefs={notifPrefs}
          setNotifPrefs={setNotifPrefs}
        />
      </div>
      <SecurityFlow isOpen={showSecurityFlow} onClose={() => setShowSecurityFlow(false)} toast={toast} role="superadmin" accountEmail={me?.email || ''} />
    </div>
  );
}

export default SuperAdminProfile;
