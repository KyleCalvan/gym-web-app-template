import { useState } from 'react';
import { Avatar, Badge, Modal, TabbedCard, Field, TextInput } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';
import { SecurityFlow } from '../shared/components/SecurityFlow';
import ProfileSettingsPanel from '../shared/ProfileSettingsPanel';
import type { ViewProps } from '../types.ts';

function MemberProfile({ members, setMembers, currentUserId, toast, addAudit, onDeleteAccount, notifPrefs, setNotifPrefs, currentUser, onProfilePhotoChange }: ViewProps){
  const me = members.find(m => m.id === currentUserId) || members[0];
  const [info, setInfo] = useState({
    name: me?.name || currentUser?.name || '',
    email: me?.email || '',
    phone: me?.phone || '',
    emergency: '',
  });

  const [showSecurityFlow, setShowSecurityFlow] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

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
      onProfilePhotoChange?.(url);
      setMembers(prev => prev.map(m => m.id === me.id ? {...m, avatarUrl: url} : m));
      toast('Photo updated');
      addAudit?.('info', 'Profile photo updated', me?.id || 'member');
    }, msg => toast(msg));
    e.target.value = '';
  };

  const isFrozen = me?.status === 'Frozen';

  const requestDelete = () => {
    if (!me || deleteConfirmation !== 'DELETE') return;
    setConfirmDelete(false);
    setDeleteConfirmation('');
    onDeleteAccount?.(me.id);
  };

  return (
    <div className="grid grid-1-2 profile-page-grid">
      <TabbedCard title={me?.name || currentUser?.name || 'Member'}>
        <div className="profile-photo-content">
          <Avatar src={me?.avatarUrl || currentUser?.avatarUrl} name={me?.name || currentUser?.name || 'Member'} size={96} />
          <div>
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
          <div style={{padding:'8px 10px', background:'var(--paper)', border:'1.5px solid var(--amber)', borderRadius:'var(--radius)', fontSize:13.2, color:'var(--steel)', marginBottom:10}}>
            <Badge status="Frozen" /> &nbsp;Account frozen — admin must unfreeze to resume activity.
          </div>
        )}
      </TabbedCard>
      <div>
        <ProfileSettingsPanel
          account={
            <div className="profile-settings-account-grid">
              <div className="profile-settings-account-item"><div className="eyebrow">Member ID</div><p className="mono">{me?.id || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Plan</div><p>{me?.plan || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Member Since</div><p className="mono">{me?.joined || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Account Status</div><p>{me?.status || 'Active'}</p></div>
            </div>
          }
          profile={
          <form onSubmit={submit}>
            <div className="grid grid-2">
              <Field label="Full Name"><TextInput required value={info.name} onChange={v=>setInfo(i=>({...i, name:v}))} /></Field>
              <Field label="Email"><TextInput type="email" required value={info.email} onChange={v=>setInfo(i=>({...i, email:v}))} /></Field>
              <Field label="Phone"><TextInput value={info.phone} onChange={v=>setInfo(i=>({...i, phone:v}))} /></Field>
              <Field label="Emergency Contact"><TextInput placeholder="+63 9XX XXX XXXX" value={info.emergency} onChange={v=>setInfo(i=>({...i, emergency:v}))} /></Field>
            </div>
            <div style={{display:'flex', gap:12, marginTop:12}}>
              <button className="btn btn-signal btn-sm" type="submit" style={{width: 'auto'}}>Save Changes</button>
            </div>
          </form>
          }
          onOpenSecurity={() => setShowSecurityFlow(true)}
          notifPrefs={notifPrefs}
          setNotifPrefs={setNotifPrefs}
          deleteAccount={
            <>
              <h2>Delete Account</h2>
              <p className="profile-delete-warning">
                <strong>This action is permanent.</strong> You will lose access to this account and your membership profile will be removed from the gym app. Any financial or audit records that must be retained under the gym's operating or legal retention rules may remain. You would need to register again to use the app.
              </p>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
                Delete Account
              </button>
            </>
          }
        />
      </div>
      <SecurityFlow isOpen={showSecurityFlow} onClose={() => setShowSecurityFlow(false)} toast={toast} role="member" accountEmail={me?.email || ''} />

      {confirmDelete && (
        <Modal title="Confirm Account Deletion" showCloseButton={false} onClose={() => { setConfirmDelete(false); setDeleteConfirmation(''); }}>
          <div style={{ padding: '0 24px 24px' }}>
            <p style={{ margin: '0 0 12px', color: 'var(--steel)', fontSize: 14, lineHeight: 1.5 }}>
              Your profile will be removed and you will be signed out. Financial or audit records may be retained where required by the gym's retention rules. This cannot be undone.
            </p>
            <Field label='Type "DELETE" to confirm'><TextInput value={deleteConfirmation} onChange={setDeleteConfirmation} autoComplete="off" /></Field>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" type="button" onClick={() => { setConfirmDelete(false); setDeleteConfirmation(''); }}>Cancel</button>
              <button className="btn btn-danger" type="button" disabled={deleteConfirmation !== 'DELETE'} onClick={requestDelete}>Delete Permanently</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default MemberProfile;
