// @ts-nocheck
import { useState } from 'react';
import { Avatar, Badge, Table, TabbedCard, Modal, Field, TextInput, Select } from '../shared';
import type { Staff, StaffRole, StaffShift, StaffStatus } from '../types.ts';

function AdminPeople({ trainers, setTrainers, staff, setStaff, members, sessions, setSessions, toast, addAudit }){
  // ===== Trainer state =====
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({name:'', specialty:'', certs:'', sessionPrice:'900', status:'Active'});
  const [viewing, setViewing] = useState(null);
  const [assignForm, setAssignForm] = useState({trainerId:trainers[0]?.id||'', memberId:members[0]?.id||'', dateTime:''});
  const [pendingTrainerRemove, setPendingTrainerRemove] = useState(null);
  const [pendingStaffRemove, setPendingStaffRemove] = useState(null);

  const startEdit = (t) => {
    setEditing(t);
    setEditForm({name:t.name, specialty:t.specialty, certs:t.certs, sessionPrice:String(t.sessionPrice), status:t.status});
  };
  const submitEdit = (e) => {
    e.preventDefault();
    setTrainers(prev => prev.map(t => t.id===editing.id ? {...t, ...editForm, sessionPrice: Number(editForm.sessionPrice)} : t));
    toast('Trainer updated — ' + editForm.name);
    addAudit?.('info', 'Trainer updated', editForm.name);
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
    addAudit?.('info', 'Trainer registered', newT.name + ' (' + id + ')');
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
    addAudit?.('info', 'Session assigned', trainer.name + ' ↔ ' + member.name);
    setAssignForm({trainerId:trainers[0]?.id||'', memberId:members[0]?.id||'', dateTime:''});
  };

  // ===== Staff state =====
  const [staffAdding, setStaffAdding] = useState(false);
  const [staffAddForm, setStaffAddForm] = useState({name:'', role:'Front Desk' as StaffRole, shift:'Morning' as StaffShift, email:'', phone:'', status:'Active' as StaffStatus});
  const [staffEditing, setStaffEditing] = useState<Staff | null>(null);
  const [staffEditForm, setStaffEditForm] = useState<Staff | null>(null);

  const startStaffEdit = (s: Staff) => {
    setStaffEditing(s);
    setStaffEditForm({...s});
  };
  const submitStaffEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEditForm) return;
    setStaff(prev => prev.map(s => s.id === staffEditForm.id ? staffEditForm : s));
    toast('Staff updated — ' + staffEditForm.name);
    addAudit?.('info', 'Staff updated', staffEditForm.name);
    setStaffEditing(null); setStaffEditForm(null);
  };
  const submitStaffAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffAddForm.name.trim()) { toast('Staff name is required'); return; }
    const id = 'S-' + String(staff.length + 1).padStart(2, '0');
    const newS: Staff = {
      id,
      name: staffAddForm.name.trim(),
      role: staffAddForm.role,
      shift: staffAddForm.shift,
      status: staffAddForm.status,
      email: staffAddForm.email.trim(),
      phone: staffAddForm.phone.trim(),
      hireDate: new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'}),
    };
    setStaff(prev => [...prev, newS]);
    toast('Staff added — ' + newS.name);
    addAudit?.('info', 'Staff registered', newS.name + ' (' + id + ')');
    setStaffAdding(false);
    setStaffAddForm({name:'', role:'Front Desk', shift:'Morning', email:'', phone:'', status:'Active'});
  };
  const removeStaff = (s: Staff) => {
    const now = new Date().toISOString();
    setStaff(prev => prev.map(x => x.id === s.id ? { ...x, deletedAt: now } : x));
    toast('Staff removed — ' + s.name);
    addAudit?.('warn', 'Staff removed (soft)', s.name + ' (' + s.id + ')');
    setPendingStaffRemove(null);
  };
  const removeTrainer = (t) => {
    const now = new Date().toISOString();
    setTrainers(prev => prev.map(x => x.id === t.id ? { ...x, deletedAt: now } : x));
    toast('Trainer removed — ' + t.name);
    addAudit?.('warn', 'Trainer removed (soft)', t.name + ' (' + t.id + ')');
    setPendingTrainerRemove(null);
  };

  return (
    <>
      {/* ===== Trainer Roster ===== */}
      <TabbedCard label="Ops" title="Trainer Roster" right={<button className="btn btn-signal btn-sm" onClick={()=>setAdding(true)}>+ Add Trainer</button>}>
        <div className="grid grid-2">
          {trainers.filter(t => !t.deletedAt).map(t=>(
            <div className="card" key={t.id}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div style={{display:'flex', gap:10}}>
                  <Avatar src={t.avatarUrl} name={t.name} size={38} />
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
                <button className="btn btn-ghost btn-sm" onClick={()=>setPendingTrainerRemove(t)}>Remove</button>
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

      <div style={{height:18}}></div>

      {/* ===== Staff Roster ===== */}
      <TabbedCard label="Ops" title="Staff Roster" right={<button className="btn btn-signal btn-sm" onClick={()=>setStaffAdding(true)}>+ Add Staff</button>}>
        {staff.filter(s => !s.deletedAt).length === 0 ? (
          <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>
            No staff yet. Click <b>+ Add Staff</b> to add the first one.
          </div>
        ) : (
          <div className="grid grid-2">
            {staff.filter(s => !s.deletedAt).map(s=>(
              <div className="card" key={s.id}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                  <div style={{display:'flex', gap:10}}>
                    <Avatar src={s.avatarUrl} name={s.name} size={38} />
                    <div>
                      <b>{s.name}</b>
                      <div style={{fontSize:12, color:'var(--steel)'}}>{s.role} · {s.shift} shift</div>
                    </div>
                  </div>
                  <Badge status={s.status}/>
                </div>
                <div className="grid grid-2" style={{marginTop:14, fontSize:12}}>
                  <div><div className="eyebrow">Email</div><span className="mono" style={{fontSize:11.5}}>{s.email}</span></div>
                  <div><div className="eyebrow">Phone</div><span className="mono">{s.phone}</span></div>
                </div>
                <div style={{display:'flex', gap:8, marginTop:14}}>
                  <button className="btn btn-outline btn-sm" onClick={()=>startStaffEdit(s)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setPendingStaffRemove(s)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabbedCard>

      {/* ===== Trainer modals ===== */}
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

      {/* ===== Staff modals ===== */}
      {staffAdding && (
        <Modal title="Add Staff" onClose={()=>setStaffAdding(false)}>
          <form onSubmit={submitStaffAdd}>
            <Field label="Full Name"><TextInput required value={staffAddForm.name} onChange={v=>setStaffAddForm(f=>({...f, name:v}))} /></Field>
            <div className="grid grid-2">
              <Field label="Role">
                <Select value={staffAddForm.role} onChange={v=>setStaffAddForm(f=>({...f, role:v as StaffRole}))}>
                  <option>Front Desk</option><option>Sales</option><option>Manager</option>
                </Select>
              </Field>
              <Field label="Shift">
                <Select value={staffAddForm.shift} onChange={v=>setStaffAddForm(f=>({...f, shift:v as StaffShift}))}>
                  <option>Morning</option><option>Evening</option><option>Night</option>
                </Select>
              </Field>
            </div>
            <Field label="Email"><TextInput type="email" placeholder="name@vinathletics.gym" value={staffAddForm.email} onChange={v=>setStaffAddForm(f=>({...f, email:v}))} /></Field>
            <Field label="Phone"><TextInput placeholder="+63 9XX XXX XXXX" value={staffAddForm.phone} onChange={v=>setStaffAddForm(f=>({...f, phone:v}))} /></Field>
            <Field label="Status">
              <Select value={staffAddForm.status} onChange={v=>setStaffAddForm(f=>({...f, status:v as StaffStatus}))}>
                <option>Active</option><option>On Leave</option><option>Inactive</option>
              </Select>
            </Field>
            <button className="btn btn-signal btn-block" type="submit">Add Staff</button>
          </form>
        </Modal>
      )}

      {staffEditing && staffEditForm && (
        <Modal title="Edit Staff" onClose={()=>{setStaffEditing(null); setStaffEditForm(null);}}>
          <form onSubmit={submitStaffEdit}>
            <Field label="Full Name"><TextInput required value={staffEditForm.name} onChange={v=>setStaffEditForm(f=>({...f, name:v}) as Staff)} /></Field>
            <div className="grid grid-2">
              <Field label="Role">
                <Select value={staffEditForm.role} onChange={v=>setStaffEditForm(f=>({...f, role:v as StaffRole}) as Staff)}>
                  <option>Front Desk</option><option>Sales</option><option>Manager</option>
                </Select>
              </Field>
              <Field label="Shift">
                <Select value={staffEditForm.shift} onChange={v=>setStaffEditForm(f=>({...f, shift:v as StaffShift}) as Staff)}>
                  <option>Morning</option><option>Evening</option><option>Night</option>
                </Select>
              </Field>
            </div>
            <Field label="Email"><TextInput type="email" value={staffEditForm.email} onChange={v=>setStaffEditForm(f=>({...f, email:v}) as Staff)} /></Field>
            <Field label="Phone"><TextInput value={staffEditForm.phone} onChange={v=>setStaffEditForm(f=>({...f, phone:v}) as Staff)} /></Field>
            <Field label="Status">
              <Select value={staffEditForm.status} onChange={v=>setStaffEditForm(f=>({...f, status:v as StaffStatus}) as Staff)}>
                <option>Active</option><option>On Leave</option><option>Inactive</option>
              </Select>
            </Field>
            <button className="btn btn-signal btn-block" type="submit">Save Changes</button>
          </form>
        </Modal>
      )}

      {/* ===== Remove confirmations ===== */}
      {pendingTrainerRemove && (
        <Modal title="Remove Trainer?" onClose={()=>setPendingTrainerRemove(null)}>
          <p style={{fontSize:13, color:'var(--steel)', marginBottom:14}}>
            You're about to remove <b>{pendingTrainerRemove.name}</b>. They will be archived
            and hidden from the trainer roster. A super admin can restore or permanently delete them later.
          </p>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button className="btn btn-outline" type="button" onClick={()=>setPendingTrainerRemove(null)}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={()=>removeTrainer(pendingTrainerRemove)}>Remove</button>
          </div>
        </Modal>
      )}

      {pendingStaffRemove && (
        <Modal title="Remove Staff?" onClose={()=>setPendingStaffRemove(null)}>
          <p style={{fontSize:13, color:'var(--steel)', marginBottom:14}}>
            You're about to remove <b>{pendingStaffRemove.name}</b>. They will be archived
            and hidden from the staff roster. A super admin can restore or permanently delete them later.
          </p>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button className="btn btn-outline" type="button" onClick={()=>setPendingStaffRemove(null)}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={()=>removeStaff(pendingStaffRemove)}>Remove</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default AdminPeople;