// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, Table, Modal, Field, Select, TextInput } from '../shared';

function TrainerSessions({ sessions, setSessions, toast }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({member:'', type:'1-on-1', time:'', status:'Booked'});

  const startNew = () => { setForm({member:'', type:'1-on-1', time:'', status:'Booked'}); setEditing(null); setOpen(true); };
  const startEdit = (s) => { setForm({member:s.member, type:s.type, time:s.time, status:s.status}); setEditing(s); setOpen(true); };

  const save = (e) => {
    e.preventDefault();
    if (!form.member.trim() || !form.time.trim()) { toast('Member and time are required'); return; }
    if (editing) {
      setSessions(prev => prev.map(s => s.id === editing.id ? {...s, ...form} : s));
      toast('Session updated');
    } else {
      const id = 'S-' + (5000 + sessions.length);
      setSessions(prev => [...prev, {id, ...form, day:'Today'}]);
      toast('Session created (' + id + ')');
    }
    setOpen(false);
  };

  const remove = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    toast('Session removed');
  };

  return (
    <TabbedCard label="Sessions" title="Coaching Sessions" right={<button className="btn btn-signal btn-sm" onClick={startNew}>+ New Session</button>}>
      <Table columns={['ID','Member','Type','Time','Status','']} rows={sessions} renderRow={s=>(
        <tr key={s.id}>
          <td className="mono">{s.id}</td><td>{s.member}</td><td>{s.type}</td><td className="mono">{s.time}</td><td>{s.status}</td>
          <td>
            <button className="btn btn-ghost btn-sm" onClick={()=>startEdit(s)}>Edit</button>
            <button className="btn btn-outline btn-sm" style={{marginLeft:6}} onClick={()=>remove(s.id)}>Remove</button>
          </td>
        </tr>
      )} />

      {open && (
        <Modal title={editing ? 'Edit Session' : 'New Session'} onClose={()=>setOpen(false)}>
          <form onSubmit={save}>
            <Field label="Member Name"><TextInput required value={form.member} onChange={v=>setForm(f=>({...f, member:v}))} placeholder="Member name"/></Field>
            <Field label="Type">
              <Select value={form.type} onChange={v=>setForm(f=>({...f, type:v}))}>
                <option>1-on-1</option><option>Group</option><option>Assessment</option>
              </Select>
            </Field>
            <Field label="Time"><TextInput required value={form.time} onChange={v=>setForm(f=>({...f, time:v}))} placeholder="e.g. 10:00 AM"/></Field>
            <Field label="Status">
              <Select value={form.status} onChange={v=>setForm(f=>({...f, status:v}))}>
                <option>Booked</option><option>Attended</option><option>No-Show</option>
              </Select>
            </Field>
            <button className="btn btn-signal btn-block" type="submit">{editing ? 'Save Changes' : 'Create Session'}</button>
          </form>
        </Modal>
      )}
    </TabbedCard>
  );
}

export default TrainerSessions;