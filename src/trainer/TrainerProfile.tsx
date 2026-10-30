// @ts-nocheck
import { useState } from 'react';
import { Avatar, TabbedCard, Field, TextInput, Select } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';
import { SecurityFlow } from '../shared/components/SecurityFlow';
import ProfileSettingsPanel from '../shared/ProfileSettingsPanel';

function TrainerProfile({ trainers, currentUserId, toast, notifPrefs, setNotifPrefs, currentUser, onTrainerAction }) {
  const trainer = trainers.find(person => person.id === currentUserId) || trainers[0];
  const [form, setForm] = useState({
    name: trainer?.name || currentUser?.name || '', specialty: trainer?.specialty || '',
    email: trainer?.email || '', bio: trainer?.bio || '',
  });

  const [showSecurityFlow, setShowSecurityFlow] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    try { await onTrainerAction('profile.update', form); toast('Profile saved'); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not save profile'); }
  };

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onPickImage(file, url => {
      void onTrainerAction('profile.update', { ...form, avatarUrl: url })
        .then(() => toast('Photo updated'))
        .catch(error => toast(error instanceof Error ? error.message : 'Could not update photo'));
    }, msg => toast(msg));
    e.target.value = '';
  };

  return (
    <div className="grid grid-1-2 profile-page-grid">
      <TabbedCard title={trainer?.name || currentUser?.name || 'Trainer'}>
        <div className="profile-photo-content">
          <Avatar src={trainer?.avatarUrl || currentUser?.avatarUrl} name={trainer?.name || currentUser?.name || 'Trainer'} size={96} />
          <div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => document.getElementById('trainer-avatar-input')?.click()}
            >
              Change Photo
            </button>
            <input
              id="trainer-avatar-input"
              type="file"
              accept="image/*"
              style={{display:'none'}}
              onChange={handleAvatarFile}
            />
            <div style={{fontSize:12.7, color:'var(--steel)', marginTop:6}}>JPG or PNG, up to 1.5 MB.</div>
          </div>
        </div>
      </TabbedCard>
      <div>
        <ProfileSettingsPanel
          account={
            <div className="profile-settings-account-grid">
              <div className="profile-settings-account-item"><div className="eyebrow">Trainer ID</div><p className="mono">{trainer?.displayId || trainer?.id || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Status</div><p>{trainer?.status || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Rating</div><p className="mono">{trainer?.rating || '—'} ★</p></div>
            </div>
          }
          profile={
          <form onSubmit={save}>
            <Field label="Display Name"><TextInput value={form.name} onChange={v=>setForm(f=>({...f, name:v}))} /></Field>
            <Field label="Specialty">
              <Select value={form.specialty} onChange={v=>setForm(f=>({...f, specialty:v}))}>
                <option>Strength</option><option>HIIT</option><option>Yoga</option><option>Mobility</option><option>Conditioning</option>
              </Select>
            </Field>
            <Field label="Email"><TextInput type="email" value={form.email} onChange={v=>setForm(f=>({...f, email:v}))} /></Field>
            <Field label="Short Bio"><TextInput value={form.bio} onChange={v=>setForm(f=>({...f, bio:v}))} placeholder="A short tagline for the landing page" /></Field>
            <div style={{display:'flex', gap:12, marginTop:12}}>
              <button className="btn btn-signal btn-sm" type="submit" style={{width: 'auto'}}>Save Profile</button>
            </div>
          </form>
          }
          onOpenSecurity={() => setShowSecurityFlow(true)}
          notifPrefs={notifPrefs}
          setNotifPrefs={setNotifPrefs}
        />
      </div>
      <SecurityFlow isOpen={showSecurityFlow} onClose={() => setShowSecurityFlow(false)} toast={toast} role="trainer" accountEmail={trainer?.email || ''} />
    </div>
  );
}

export default TrainerProfile;
