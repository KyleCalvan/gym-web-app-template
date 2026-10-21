import { useState } from 'react';
import { Avatar, TabbedCard, Field, TextInput } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';
import { SecurityFlow } from '../shared/components/SecurityFlow';
import ProfileSettingsPanel from '../shared/ProfileSettingsPanel';
import type { ViewProps } from '../types.ts';

function AdminProfile({ admins, setAdmins, currentUserId, toast, addAudit, notifPrefs, setNotifPrefs }: ViewProps) {
  const me = admins.find(a => a.id === currentUserId) || admins[0];
  const [info, setInfo] = useState({
    name: me?.name || '',
    email: me?.email || '',
    phone: me?.phone || '',
    phoneSecondary: me?.phoneSecondary || '',
  });

  const [showSecurityFlow, setShowSecurityFlow] = useState(false);

  const submitInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setAdmins(prev => prev.map(a => a.id === me.id ? {...a, ...info} : a));
    toast('Profile updated');
    addAudit?.('info', 'Profile updated', me?.id || 'admin');
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onPickImage(file, url => {
      setAdmins(prev => prev.map(a => a.id === me.id ? {...a, avatarUrl: url} : a));
      toast('Photo updated');
      addAudit?.('info', 'Profile photo updated', me?.id || 'admin');
    }, msg => toast(msg));
    e.target.value = '';
  };

  return (
    <div className="grid grid-1-2">
      <TabbedCard title={me?.name || 'Admin'}>
        <div style={{textAlign:'center', marginBottom:14}}>
          <Avatar src={me?.avatarUrl} name={me?.name || 'Admin'} size={64} />
          <div style={{marginTop:10}}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => document.getElementById('admin-avatar-input')?.click()}
            >
              Change Photo
            </button>
            <input
              id="admin-avatar-input"
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
              <div className="profile-settings-account-item"><div className="eyebrow">Admin ID</div><p className="mono">{me?.id || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Role</div><p>Administrator</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Admin Since</div><p className="mono">{me?.createdAt || '—'}</p></div>
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
      <SecurityFlow isOpen={showSecurityFlow} onClose={() => setShowSecurityFlow(false)} toast={toast} role="admin" accountEmail={me?.email || ''} />
    </div>
  );
}

export default AdminProfile;
