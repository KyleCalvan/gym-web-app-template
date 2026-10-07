import { useState } from 'react';
import { Avatar, Badge, Modal, TabbedCard, Field, TextInput } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';
import { SecurityFlow } from '../shared/components/SecurityFlow';
import type { ViewProps } from '../types.ts';

function MemberProfile({ members, setMembers, currentUserId, toast, addAudit, onDeleteAccount }: ViewProps){
  const me = members.find(m => m.id === currentUserId) || members[0];
  const [info, setInfo] = useState({
    name: me?.name || '',
    email: me?.email || '',
    phone: me?.phone || '',
    emergency: '',
  });

  const [showSecurityFlow, setShowSecurityFlow] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMembers(prev => prev.map(m => m.id === me.id ? {...m, ...info} : m));
    toast('Profile updated');
    addAudit?.('info', 'Profile updated', me?.id || 'member');
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const requestDelete = () => {
    if (!me) return;
    setConfirmDelete(false);
    onDeleteAccount?.(me.id);
  };

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
          <div style={{padding:'8px 10px', background:'var(--paper)', border:'1.5px solid var(--amber)', borderRadius:'var(--radius)', fontSize:12, color:'var(--steel)', marginBottom:10}}>
            <Badge status="Frozen" /> &nbsp;Account frozen — admin must unfreeze to resume activity.
          </div>
        )}
        <div style={{fontSize:12.5}}>
          <div className="eyebrow">Member ID</div><p className="mono">{me?.id || '—'}</p>
          <div className="eyebrow">Plan</div><p>{me?.plan || '—'}</p>
          <div className="eyebrow">Member Since</div><p className="mono">{me?.joined || '—'}</p>
        </div>
      </TabbedCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <TabbedCard label="Info" title="Account Information">
          <form onSubmit={submit}>
            <div className="grid grid-2">
              <Field label="Full Name"><TextInput required value={info.name} onChange={v=>setInfo(i=>({...i, name:v}))} /></Field>
              <Field label="Email"><TextInput type="email" required value={info.email} onChange={v=>setInfo(i=>({...i, email:v}))} /></Field>
              <Field label="Phone"><TextInput value={info.phone} onChange={v=>setInfo(i=>({...i, phone:v}))} /></Field>
              <Field label="Emergency Contact"><TextInput placeholder="+63 9XX XXX XXXX" value={info.emergency} onChange={v=>setInfo(i=>({...i, emergency:v}))} /></Field>
            </div>
            <div style={{display:'flex', gap:12, marginTop:12}}>
              <button className="btn btn-signal btn-sm" type="submit" style={{width: 'auto'}}>Save Changes</button>
              <button className="btn btn-outline btn-sm" type="button" style={{width: 'auto'}} onClick={() => setShowSecurityFlow(true)}>Security Settings</button>
            </div>
          </form>
        </TabbedCard>

        <TabbedCard label="Danger Zone" title="Delete Account">
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--steel)', lineHeight: 1.5 }}>
            Permanently remove your membership record. This clears your profile, plan and history
            from the gym ledger and cannot be undone — you'd need to register again to come back.
          </p>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            style={{ width: 'auto' }}
            onClick={() => setConfirmDelete(true)}
          >
            Delete Account
          </button>
        </TabbedCard>
      </div>
      <SecurityFlow isOpen={showSecurityFlow} onClose={() => setShowSecurityFlow(false)} toast={toast} />

      {confirmDelete && (
        <Modal title="Delete Account" showCloseButton={false} onClose={() => setConfirmDelete(false)}>
          <div style={{ padding: '0 24px 24px' }}>
            <p style={{ margin: '0 0 18px', color: 'var(--steel)', fontSize: 14, lineHeight: 1.5 }}>
              Are you sure you want to delete your account? Your membership, plan and activity
              history will be permanently removed, and you'll be signed out.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-danger" type="button" onClick={requestDelete}>Delete Permanently</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default MemberProfile;
