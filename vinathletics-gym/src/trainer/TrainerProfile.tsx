// @ts-nocheck
import { useState } from 'react';
import { Avatar, TabbedCard, Field, TextInput, Select } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';

function TrainerProfile({ trainer, setTrainers, toast, addAudit }) {
  const [form, setForm] = useState({
    name: trainer?.name || '', specialty: trainer?.specialty || '',
    email: trainer?.email || '', bio: trainer?.bio || '',
  });

  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const save = (e) => {
    e.preventDefault();
    setTrainers(prev => prev.map(t => t.id === trainer.id ? {...t, ...form} : t));
    toast('Profile saved');
    addAudit?.('info', 'Profile updated', trainer?.id || 'trainer');
  };

  const submitPassword = (e) => {
    e.preventDefault();
    if (password.new !== password.confirm) {
      toast('Passwords do not match');
      return;
    }
    toast('Password changed successfully');
    setPassword({ current: '', new: '', confirm: '' });
    addAudit?.('info', 'Password changed', trainer?.id || 'trainer');
  };

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onPickImage(file, url => {
      setTrainers(prev => prev.map(t => t.id === trainer.id ? {...t, avatarUrl: url} : t));
      toast('Photo updated');
      addAudit?.('info', 'Profile photo updated', trainer?.id || 'trainer');
    }, msg => toast(msg));
    e.target.value = '';
  };

  return (
    <div className="grid grid-1-2">
      <TabbedCard label="Profile" title={trainer?.name || 'Trainer'}>
        <div style={{textAlign:'center', marginBottom:14}}>
          <Avatar src={trainer?.avatarUrl} name={trainer?.name || 'Trainer'} size={64} />
          <div style={{marginTop:10}}>
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
            <div style={{fontSize:11.5, color:'var(--steel)', marginTop:6}}>JPG or PNG, up to 1.5 MB.</div>
          </div>
        </div>
        <div style={{fontSize:12.5}}>
          <div className="eyebrow">Trainer ID</div><p className="mono">{trainer?.id || '—'}</p>
          <div className="eyebrow">Status</div><p>{trainer?.status || '—'}</p>
          <div className="eyebrow">Rating</div><p className="mono">{trainer?.rating || '—'} ★</p>
        </div>
      </TabbedCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <TabbedCard label="Profile" title="Trainer Profile">
          <form onSubmit={save}>
            <Field label="Display Name"><TextInput value={form.name} onChange={v=>setForm(f=>({...f, name:v}))} /></Field>
            <Field label="Specialty">
              <Select value={form.specialty} onChange={v=>setForm(f=>({...f, specialty:v}))}>
                <option>Strength</option><option>HIIT</option><option>Yoga</option><option>Mobility</option><option>Conditioning</option>
              </Select>
            </Field>
            <Field label="Email"><TextInput type="email" value={form.email} onChange={v=>setForm(f=>({...f, email:v}))} /></Field>
            <Field label="Short Bio"><TextInput value={form.bio} onChange={v=>setForm(f=>({...f, bio:v}))} placeholder="A short tagline for the landing page" /></Field>
            <button className="btn btn-signal btn-block" type="submit">Save Profile</button>
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

export default TrainerProfile;
