// @ts-nocheck
import { useState } from 'react';
import { Avatar, Badge, TabbedCard, Field, TextInput } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';

function MemberProfile({ members, setMembers, currentUserId, toast, addAudit }){
  const me = members.find(m => m.id === currentUserId) || members[0];
  const [info, setInfo] = useState({
    name: me?.name || '',
    email: me?.email || '',
    phone: me?.phone || '',
    emergency: '',
  });

  const submit = (e) => {
    e.preventDefault();
    setMembers(prev => prev.map(m => m.id === me.id ? {...m, ...info} : m));
    toast('Profile updated');
    addAudit?.('info', 'Profile updated', me?.id || 'member');
  };

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onPickImage(file, url => {
      setMembers(prev => prev.map(m => m.id === me.id ? {...m, avatarUrl: url} : m));
      toast('Photo updated');
      addAudit?.('info', 'Profile photo updated', me?.id || 'member');
    }, msg => toast(msg));
    e.target.value = '';
  };

  const isFrozen = me?.status === 'Frozen';

  return (
    <div className="grid grid-1-2">
      <TabbedCard label="Profile" title={me?.name || 'Member'}>
        <div style={{textAlign:'center', marginBottom:14}}>
          <Avatar src={me?.avatarUrl} name={me?.name || 'Member'} size={64} />
          <div style={{marginTop:10}}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => document.getElementById('member-avatar-input')?.click()}
            >
              Change Photo
            </button>
            <input
              id="member-avatar-input"
              type="file"
              accept="image/*"
              style={{display:'none'}}
              onChange={handleAvatarFile}
            />
          </div>
        </div>
        {isFrozen && (
          <div style={{padding:'8px 10px', background:'var(--paper)', border:'1.5px solid var(--amber)', borderRadius:3, fontSize:12, color:'var(--steel)', marginBottom:10}}>
            <Badge status="Frozen" /> &nbsp;Account frozen — admin must unfreeze to resume activity.
          </div>
        )}
        <div style={{fontSize:12.5}}>
          <div className="eyebrow">Member ID</div><p className="mono">{me?.id || '—'}</p>
          <div className="eyebrow">Plan</div><p>{me?.plan || '—'}</p>
          <div className="eyebrow">Member Since</div><p className="mono">{me?.joined || '—'}</p>
        </div>
      </TabbedCard>
      <TabbedCard label="Info" title="Account Information">
        <form onSubmit={submit}>
          <div className="grid grid-2">
            <Field label="Full Name"><TextInput required value={info.name} onChange={v=>setInfo(i=>({...i, name:v}))} /></Field>
            <Field label="Email"><TextInput type="email" required value={info.email} onChange={v=>setInfo(i=>({...i, email:v}))} /></Field>
            <Field label="Phone"><TextInput value={info.phone} onChange={v=>setInfo(i=>({...i, phone:v}))} /></Field>
            <Field label="Emergency Contact"><TextInput placeholder="+63 9XX XXX XXXX" value={info.emergency} onChange={v=>setInfo(i=>({...i, emergency:v}))} /></Field>
          </div>
          <button className="btn btn-signal btn-sm" type="submit">Save Changes</button>
        </form>
      </TabbedCard>
    </div>
  );
}

export default MemberProfile;
