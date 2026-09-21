import { useState } from 'react';
import { Avatar, Badge, TabbedCard, Field, TextInput } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';

function SuperAdminProfile({ superadmins, setSuperadmins, currentUserId, toast, addAudit }) {
  const me = superadmins.find(s => s.id === currentUserId) || superadmins[0];
  const [info, setInfo] = useState({
    name: me?.name || '',
    email: me?.email || '',
    phone: me?.phone || '',
  });

  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const submitInfo = (e) => {
    e.preventDefault();
    setSuperadmins(prev => prev.map(s => s.id === me.id ? {...s, ...info} : s));
    toast('Profile updated');
    addAudit?.('info', 'Profile updated', me?.id || 'superadmin');
  };

  const submitPassword = (e) => {
    e.preventDefault();
    if (password.new !== password.confirm) {
      toast('Passwords do not match');
      return;
    }
    // Password change logic would go here
    toast('Password changed successfully');
    setPassword({ current: '', new: '', confirm: '' });
    addAudit?.('info', 'Password changed', me?.id || 'superadmin');
  };

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onPickImage(file, url => {
      setSuperadmins(prev => prev.map(s => s.id === me.id ? {...s, avatarUrl: url} : s));
      toast('Photo updated');
      addAudit?.('info', 'Profile photo updated', me?.id || 'superadmin');
    }, msg => toast(msg));
    e.target.value = '';
  };

  return (
    <div className="grid grid-1-2">
      <TabbedCard label="Profile" title={me?.name || 'Super Admin'}>
        <div style={{textAlign:'center', marginBottom:14}}>
          <Avatar src={me?.avatarUrl} name={me?.name || 'Super Admin'} size={64} />
          <div style={{marginTop:10}}>
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
        <div style={{fontSize:12.5}}>
          <div className="eyebrow">Super Admin ID</div><p className="mono">{me?.id || '—'}</p>
          <div className="eyebrow">Super Admin Since</div><p className="mono">{me?.joined || '—'}</p>
        </div>
      </TabbedCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <TabbedCard label="Info" title="Account Information">
          <form onSubmit={submitInfo}>
            <div className="grid grid-2">
              <Field label="Full Name"><TextInput required value={info.name} onChange={v=>setInfo(i=>({...i, name:v}))} /></Field>
              <Field label="Email"><TextInput type="email" required value={info.email} onChange={v=>setInfo(i=>({...i, email:v}))} /></Field>
              <Field label="Phone"><TextInput value={info.phone} onChange={v=>setInfo(i=>({...i, phone:v}))} /></Field>
              <Field label="Phone (Secondary)"><TextInput value={info.phoneSecondary || ''} onChange={v=>setInfo(i=>({...i, phoneSecondary:v}))} /></Field>
            </div>
            <button className="btn btn-signal btn-sm" type="submit">Save Changes</button>
          </form>
        </TabbedCard>
        <TabbedCard label="Security" title="Change Password">
          <form onSubmit={submitPassword}>
            <div className="grid grid-1">
              <Field label="Current Password"><TextInput type="password" required value={password.current} onChange={v=>setPassword(p=>({...p, current:v}))} /></Field>
              <Field label="New Password"><TextInput type="password" required value={password.new} onChange={v=>setPassword(p=>({...p, new:v}))} /></Field>
              <Field label="Confirm New Password"><TextInput type="password" required value={password.confirm} onChange={v=>setPassword(p=>({...p, confirm:v}))} /></Field>
            </div>
            <button className="btn btn-signal btn-block" type="submit">Change Password</button>
          </form>
        </TabbedCard>
      </div>
    </div>
  );
}

export default SuperAdminProfile;
