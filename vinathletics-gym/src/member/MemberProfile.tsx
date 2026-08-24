// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, Field, TextInput } from '../shared';
import { INITIALS } from '../data.ts';

function MemberProfile({ members, setMembers, currentUserId, toast }){
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
  };

  return (
    <div className="grid grid-1-2">
      <TabbedCard label="Profile" title={me?.name || 'Member'}>
        <div style={{textAlign:'center', marginBottom:14}}>
          <span className="avatar-sm" style={{width:64, height:64, fontSize:20}}>{INITIALS(me?.name || 'JD')}</span>
        </div>
        <div style={{fontSize:12.5}}>
          <div className="eyebrow">Member ID</div><p className="mono">{me?.id || 'M-1042'}</p>
          <div className="eyebrow">Plan</div><p>{me?.plan || 'Premium'}</p>
          <div className="eyebrow">Member Since</div><p className="mono">{me?.joined || 'Feb 12, 2025'}</p>
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