// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, Field, TextInput, Select } from '../shared';

function TrainerProfile({ trainer, setTrainers, trainers, toast }) {
  const [form, setForm] = useState({
    name: trainer?.name || '', specialty: trainer?.specialty || '',
    email: trainer?.email || '', bio: trainer?.bio || '',
  });

  const save = (e) => {
    e.preventDefault();
    setTrainers(prev => prev.map(t => t.id === trainer.id ? {...t, ...form} : t));
    toast('Profile saved');
  };

  return (
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
  );
}

export default TrainerProfile;