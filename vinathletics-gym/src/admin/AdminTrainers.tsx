// @ts-nocheck
import { useState } from 'react';
import { Badge, Table, TabbedCard, Modal, Field, TextInput, Select } from '../shared';
import { INITIALS } from '../data.ts';

function AdminTrainers({ trainers, setTrainers, members, sessions, setSessions, toast }){
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({name:'', specialty:'', certs:'', sessionPrice:'900', status:'Active'});
  const [viewing, setViewing] = useState(null);
  const [assignForm, setAssignForm] = useState({trainerId:trainers[0]?.id||'', memberId:members[0]?.id||'', dateTime:''});

  const startEdit = (t) => {
    setEditing(t);
    setEditForm({name:t.name, specialty:t.specialty, certs:t.certs, sessionPrice:String(t.sessionPrice), status:t.status});
  };
  const submitEdit = (e) => {
    e.preventDefault();
    setTrainers(prev => prev.map(t => t.id===editing.id ? {...t, ...editForm, sessionPrice: Number(editForm.sessionPrice)} : t));
    toast('Trainer updated — ' + editForm.name);
    setEditing(null); setEditForm(null);
  };

  const submitAdd = (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) { toast('Trainer name is required'); return; }
    const id = 'T-0' + (trainers.length + 1);
    const newT = {
      id, name: addForm.name.trim(), specialty: addForm.specialty || 'General',
      certs: addForm.certs || '', rating: 0, sessionsWeek: 0,
      status: addForm.status, sessionPrice: Number(addForm.sessionPrice) || 900,
    };
    setTrainers(prev => [...prev, newT]);
    toast('Trainer added — ' + newT.name);
    setAdding(false);
    setAddForm({name:'', specialty:'', certs:'', sessionPrice:'900', status:'Active'});
  };

  const submitAssign = (e) => {
    e.preventDefault();
    if (!assignForm.trainerId || !assignForm.memberId || !assignForm.dateTime) { toast('All fields required'); return; }
    const trainer = trainers.find(t=>t.id===assignForm.trainerId);
    const member = members.find(m=>m.id===assignForm.memberId);
    const dt = new Date(assignForm.dateTime);
    if (isNaN(dt)) { toast('Invalid date'); return; }
    const date = dt.toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
    const time = dt.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
    const id = 'S-' + (401 + sessions.length);
    setSessions(prev => [...prev, {id, member: member.name, trainer: trainer.name, date, time, type:'Custom', status:'Pending', paid:false, amount: trainer.sessionPrice}]);
    toast('Session assigned — ' + trainer.name + ' ↔ ' + member.name);
    setAssignForm({trainerId:trainers[0]?.id||'', memberId:members[0]?.id||'', dateTime:''});
  };

  return (
    <>
      <TabbedCard label="Ops" title="Trainer Roster" right={<button className="btn btn-signal btn-sm" onClick={()=>setAdding(true)}>+ Add Trainer</button>}>
        <div className="grid grid-2">
          {trainers.map(t=>(
            <div className="card" key={t.id}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div style={{display:'flex', gap:10}}>
                  <span className="avatar-sm" style={{width:38,height:38,fontSize:13}}>{INITIALS(t.name)}</span>
                  <div>
                    <b>{t.name}</b>
                    <div style={{fontSize:12, color:'var(--steel)'}}>{t.specialty}</div>
                  </div>
                </div>
                <Badge status={t.status}/>
              </div>
              <div className="grid grid-3" style={{marginTop:14, fontSize:12}}>
                <div><div className="eyebrow">Certs</div>{t.certs}</div>
                <div><div className="eyebrow">Rating</div><span className="mono">★ {t.rating}</span></div>
                <div><div className="eyebrow">Sessions/wk</div><span className="mono">{t.sessionsWeek}</span></div>
              </div>
              <div style={{display:'flex', gap:8, marginTop:14}}>
                <button className="btn btn-outline btn-sm" onClick={()=>startEdit(t)}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>setViewing(t)}>View Schedule</button>
              </div>
            </div>
          ))}
        </div>
      </TabbedCard>

      <div style={{height:18}}></div>
      <TabbedCard label="Ops" title="Assign Trainer to Session">
        <form onSubmit={submitAssign}>
          <div className="grid grid-3">
            <Field label="Trainer">
              <Select value={assignForm.trainerId} onChange={v=>setAssignForm(f=>({...f, trainerId:v}))}>
                {trainers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Member">
              <Select value={assignForm.memberId} onChange={v=>setAssignForm(f=>({...f, memberId:v}))}>
                {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Date & Time"><TextInput type="datetime-local" required value={assignForm.dateTime} onChange={v=>setAssignForm(f=>({...f, dateTime:v}))} /></Field>
          </div>
          <button className="btn btn-signal btn-sm" type="submit">Assign Session</button>
        </form>
      </TabbedCard>

      {editing && editForm && (
        <Modal title="Edit Trainer" onClose={()=>{setEditing(null); setEditForm(null);}}>
          <form onSubmit={submitEdit}>
            <Field label="Full Name"><TextInput required value={editForm.name} onChange={v=>setEditForm(f=>({...f, name:v}))} /></Field>
            <Field label="Specialty"><TextInput value={editForm.specialty} onChange={v=>setEditForm(f=>({...f, specialty:v}))} /></Field>
            <Field label="Certifications"><TextInput value={editForm.certs} onChange={v=>setEditForm(f=>({...f, certs:v}))} /></Field>
            <Field label="Session Price (₱)"><TextInput type="number" required value={editForm.sessionPrice} onChange={v=>setEditForm(f=>({...f, sessionPrice:v}))} /></Field>
            <Field label="Status">
              <Select value={editForm.status} onChange={v=>setEditForm(f=>({...f, status:v}))}>
                <option>Active</option><option>On Leave</option><option>Inactive</option>
              </Select>
            </Field>
            <button className="btn btn-signal btn-block" type="submit">Save Changes</button>
          </form>
        </Modal>
      )}

      {adding && (
        <Modal title="Add Trainer" onClose={()=>setAdding(false)}>
          <form onSubmit={submitAdd}>
            <Field label="Full Name"><TextInput required value={addForm.name} onChange={v=>setAddForm(f=>({...f, name:v}))} /></Field>
            <Field label="Specialty"><TextInput value={addForm.specialty} onChange={v=>setAddForm(f=>({...f, specialty:v}))} placeholder="e.g. Strength & Conditioning" /></Field>
            <Field label="Certifications"><TextInput value={addForm.certs} onChange={v=>setAddForm(f=>({...f, certs:v}))} placeholder="e.g. NASM-CPT" /></Field>
            <Field label="Session Price (₱)"><TextInput type="number" required value={addForm.sessionPrice} onChange={v=>setAddForm(f=>({...f, sessionPrice:v}))} /></Field>
            <Field label="Status">
              <Select value={addForm.status} onChange={v=>setAddForm(f=>({...f, status:v}))}>
                <option>Active</option><option>On Leave</option><option>Inactive</option>
              </Select>
            </Field>
            <button className="btn btn-signal btn-block" type="submit">Add Trainer</button>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal title={viewing.name + ' — Schedule'} onClose={()=>setViewing(null)}>
          <p style={{fontSize:12.5, color:'var(--steel)', marginBottom:10}}>Sessions assigned to this trainer:</p>
          {sessions.filter(s=>s.trainer===viewing.name).length === 0 ? (
            <div style={{fontSize:13, color:'var(--steel)'}}>No sessions assigned yet.</div>
          ) : (
            <Table columns={['ID','Member','Date','Time','Status']} rows={sessions.filter(s=>s.trainer===viewing.name)} renderRow={s=>(
              <tr key={s.id}>
                <td className="mono">{s.id}</td>
                <td>{s.member}</td>
                <td className="mono">{s.date}</td>
                <td className="mono">{s.time}</td>
                <td><Badge status={s.status}/></td>
              </tr>
            )} />
          )}
        </Modal>
      )}
    </>
  );
}

export default AdminTrainers;