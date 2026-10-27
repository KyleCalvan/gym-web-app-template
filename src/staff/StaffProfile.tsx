import { useState } from 'react';
import { Avatar, TabbedCard, Field, TextInput } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';
import { SecurityFlow } from '../shared/components/SecurityFlow';
import ProfileSettingsPanel from '../shared/ProfileSettingsPanel';
import type { ViewProps } from '../types.ts';

function StaffProfile({ staff, setStaff, currentUserId, toast, addAudit, notifPrefs, setNotifPrefs, currentUser, onProfilePhotoChange }: ViewProps) {
  const me = staff.find(s => s.id === currentUserId) || staff[0];
  const [info, setInfo] = useState({
    name: me?.name || currentUser?.name || '',
    email: me?.email || '',
    phone: me?.phone || '',
    phoneSecondary: me?.phoneSecondary || '',
  });

  const [showSecurityFlow, setShowSecurityFlow] = useState(false);

  const submitInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setStaff(prev => prev.map(s => s.id === me.id ? {...s, ...info} : s));
    toast('Profile updated');
    addAudit?.('info', 'Profile updated', me?.id || 'staff');
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onPickImage(file, url => {
      onProfilePhotoChange?.(url);
      setStaff(prev => prev.map(s => s.id === me.id ? {...s, avatarUrl: url} : s));
      toast('Photo updated');
      addAudit?.('info', 'Profile photo updated', me?.id || 'staff');
    }, msg => toast(msg));
    e.target.value = '';
  };

  return (
    <div className="grid grid-1-2 profile-page-grid">
      <TabbedCard title={me?.name || currentUser?.name || 'Staff'}>
        <div className="profile-photo-content">
          <Avatar src={me?.avatarUrl || currentUser?.avatarUrl} name={me?.name || currentUser?.name || 'Staff'} size={96} />
          <div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => document.getElementById('staff-avatar-input')?.click()}
            >
              Change Photo
            </button>
            <input
              id="staff-avatar-input"
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
              <div className="profile-settings-account-item"><div className="eyebrow">Staff ID</div><p className="mono">{me?.id || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Role</div><p>Staff</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Staff Since</div><p className="mono">{me?.hireDate || '—'}</p></div>
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
      <SecurityFlow isOpen={showSecurityFlow} onClose={() => setShowSecurityFlow(false)} toast={toast} role="staff" accountEmail={me?.email || ''} />
    </div>
  );
}

export default StaffProfile;
