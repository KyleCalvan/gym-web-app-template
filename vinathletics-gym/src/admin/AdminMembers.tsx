// @ts-nocheck
import { useState } from 'react';
import { StatTile, Badge, Table, Modal, Field, TextInput, Select, TabbedCard, Avatar } from '../shared';
import { peso } from '../data.ts';

function AdminMembers({ members, setMembers, plans, setTransactions, today, toast, addAudit }){
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('All');
  const [showRegister, setShowRegister] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);

  const [reg, setReg] = useState({name:'', email:'', phone:'', plan:'Basic'});
  const submitRegister = (e) => {
    e.preventDefault();
    if (!reg.name.trim() || !reg.email.trim()) { toast('Name and email are required'); return; }
    const id = 'M-' + (1042 + members.length);
    setMembers(prev => [...prev, {...reg, id, status:'Active', joined: today}]);
    toast('Member registered — ' + reg.name + ' (' + id + ')');
    addAudit?.('info', 'Member registered', reg.name + ' (' + id + ')');
    setReg({name:'', email:'', phone:'', plan:'Basic'});
    setShowRegister(false);
  };

  const [edit, setEdit] = useState(null);
  const startEdit = () => {
    setEdit({name:selected.name, email:selected.email, phone:selected.phone, plan:selected.plan});
    setEditing(true);
  };
  const submitEdit = (e) => {
    e.preventDefault();
    setMembers(prev => prev.map(m => m.id===selected.id ? {...m, ...edit} : m));
    setSelected(s => ({...s, ...edit}));
    setEditing(false);
    toast('Member updated — ' + edit.name);
    addAudit?.('info', 'Member updated', edit.name + ' (' + selected.id + ')');
  };

  const [renewPlan, setRenewPlan] = useState(plans[0]?.name || 'Premium');
  const [renewMethod, setRenewMethod] = useState('GCash');
  const submitRenew = (e) => {
    e.preventDefault();
    const plan = plans.find(p=>p.name===renewPlan);
    const amount = plan ? plan.price : 0;
    setTransactions(prev => [{
      id: 'TXN-' + (8821 + prev.length),
      member: selected.name,
      type: 'Membership Renewal (' + renewPlan + ')',
      amount,
      method: renewMethod,
      date: today,
      status: 'Paid',
    }, ...prev]);
    setSelected(s => ({...s, status:'Active', plan: renewPlan}));
    setRenewing(false);
    toast('Renewal processed — ' + peso(amount));
    addAudit?.('info', 'Membership renewed', selected.name + ' → ' + renewPlan);
  };

  // Freeze / Unfreeze flow — modal-deferred so the destructive action has a confirmation step.
  const [pendingFreeze, setPendingFreeze] = useState(null);
  const [pendingUnfreeze, setPendingUnfreeze] = useState(null);
  const applyFreeze = () => {
    if (!pendingFreeze) return;
    setMembers(prev => prev.map(m => m.id===pendingFreeze.id ? {...m, status:'Frozen'} : m));
    setSelected(s => s && s.id===pendingFreeze.id ? {...s, status:'Frozen'} : s);
    toast('Account frozen — ' + pendingFreeze.name);
    addAudit?.('warn', 'Account frozen', pendingFreeze.name + ' (' + pendingFreeze.id + ')');
    setPendingFreeze(null);
  };
  const applyUnfreeze = () => {
    if (!pendingUnfreeze) return;
    setMembers(prev => prev.map(m => m.id===pendingUnfreeze.id ? {...m, status:'Active'} : m));
    setSelected(s => s && s.id===pendingUnfreeze.id ? {...s, status:'Active'} : s);
    toast('Account unfrozen — ' + pendingUnfreeze.name);
    addAudit?.('info', 'Account unfrozen', pendingUnfreeze.name + ' (' + pendingUnfreeze.id + ')');
    setPendingUnfreeze(null);
  };

  // Soft-delete (Remove) flow — admins send the member to archive; super admin handles restore/permanent delete.
  const [pendingRemove, setPendingRemove] = useState(null);
  const applyRemove = () => {
    if (!pendingRemove) return;
    const now = new Date().toISOString();
    setMembers(prev => prev.map(m => m.id===pendingRemove.id ? {...m, deletedAt: now} : m));
    toast('Member removed — ' + pendingRemove.name);
    addAudit?.('warn', 'Member removed (soft)', pendingRemove.name + ' (' + pendingRemove.id + ')');
    setPendingRemove(null);
    setSelected(null);
  };

  const filtered = members
    .filter(m => !m.deletedAt)
    .filter(m =>
      (statusF==='All' || m.status===statusF) &&
      (m.name.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase()))
    );

  const liveMembers = members.filter(m => !m.deletedAt);
  const counts = {
    active: liveMembers.filter(m=>m.status==='Active').length,
    expiring: liveMembers.filter(m=>m.status==='Expiring').length,
    ef: liveMembers.filter(m=>m.status==='Expired' || m.status==='Frozen').length,
  };

  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Total Members" value={liveMembers.length} tone="steel"/>
        <StatTile label="Active" value={counts.active} tone="court"/>
        <StatTile label="Expiring Soon" value={counts.expiring} tone="amber"/>
        <StatTile label="Expired / Frozen" value={counts.ef} />
      </div>

      <TabbedCard label="Members" title="Member Directory" right={<button className="btn btn-signal btn-sm" onClick={()=>setShowRegister(true)}>+ Register Member</button>}>
        <div className="search-row">
          <TextInput placeholder="Search by name or member ID…" value={q} onChange={setQ} />
          <Select value={statusF} onChange={setStatusF} style={{maxWidth:180}}>
            {['All','Active','Expiring','Frozen','Expired'].map(s=><option key={s}>{s}</option>)}
          </Select>
        </div>
        <Table columns={['Member','Contact','Plan','Status','Joined','']} rows={filtered} renderRow={m=>(
          <tr key={m.id}>
            <td><Avatar src={m.avatarUrl} name={m.name} />{m.name}<div className="mono" style={{fontSize:10.5, color:'var(--steel)'}}>{m.id}</div></td>
            <td>{m.email}<div style={{fontSize:11.5, color:'var(--steel)'}}>{m.phone}</div></td>
            <td>{m.plan}</td>
            <td><Badge status={m.status} /></td>
            <td className="mono">{m.joined}</td>
            <td><button className="btn btn-ghost btn-sm" onClick={()=>setSelected(m)}>View →</button></td>
          </tr>
        )} />
      </TabbedCard>

      {showRegister && (
        <Modal title="Register Member" onClose={()=>setShowRegister(false)}>
          <form onSubmit={submitRegister}>
            <Field label="Full Name"><TextInput required value={reg.name} onChange={v=>setReg(r=>({...r, name:v}))} placeholder="Full name" /></Field>
            <Field label="Email"><TextInput type="email" required value={reg.email} onChange={v=>setReg(r=>({...r, email:v}))} placeholder="Email address" /></Field>
            <Field label="Phone"><TextInput required value={reg.phone} onChange={v=>setReg(r=>({...r, phone:v}))} placeholder="+63 9XX XXX XXXX" /></Field>
            <Field label="Plan">
              <Select value={reg.plan} onChange={v=>setReg(r=>({...r, plan:v}))}>
                {plans.map(p=><option key={p.name}>{p.name}</option>)}
              </Select>
            </Field>
            <button className="btn btn-signal btn-block" type="submit">Register Member</button>
          </form>
        </Modal>
      )}

      {selected && !editing && !renewing && (
        <Modal title="Member Profile" onClose={()=>setSelected(null)}>
          <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:16}}>
            <Avatar src={selected.avatarUrl} name={selected.name} size={44} />
            <div><h3 style={{fontSize:18}}>{selected.name}</h3><Badge status={selected.status}/></div>
          </div>
          <div className="grid grid-2" style={{fontSize:13, marginBottom:16}}>
            <div><div className="eyebrow">Member ID</div><div className="mono">{selected.id}</div></div>
            <div><div className="eyebrow">Plan</div>{selected.plan}</div>
            <div><div className="eyebrow">Email</div>{selected.email}</div>
            <div><div className="eyebrow">Phone</div>{selected.phone}</div>
            <div><div className="eyebrow">Joined</div><span className="mono">{selected.joined}</span></div>
          </div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button className="btn btn-outline btn-sm" onClick={startEdit}>Edit Details</button>
            <button className="btn btn-outline btn-sm" onClick={()=>setRenewing(true)} disabled={selected.status==='Frozen'}>Renew Plan</button>
            {selected.status === 'Frozen' ? (
              <button className="btn btn-signal btn-sm" onClick={()=>setPendingUnfreeze(selected)}>Unfreeze Account</button>
            ) : (
              <button className="btn btn-danger btn-sm" onClick={()=>setPendingFreeze(selected)}>Freeze Account</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={()=>setPendingRemove(selected)}>Remove</button>
          </div>
        </Modal>
      )}

      {selected && editing && edit && (
        <Modal title="Edit Member" onClose={()=>{setEditing(false); setEdit(null);}}>
          <form onSubmit={submitEdit}>
            <Field label="Full Name"><TextInput required value={edit.name} onChange={v=>setEdit(e=>({...e, name:v}))} /></Field>
            <Field label="Email"><TextInput type="email" required value={edit.email} onChange={v=>setEdit(e=>({...e, email:v}))} /></Field>
            <Field label="Phone"><TextInput value={edit.phone} onChange={v=>setEdit(e=>({...e, phone:v}))} /></Field>
            <Field label="Plan">
              <Select value={edit.plan} onChange={v=>setEdit(e=>({...e, plan:v}))}>
                {plans.map(p=><option key={p.name}>{p.name}</option>)}
              </Select>
            </Field>
            <button className="btn btn-signal btn-block" type="submit">Save Changes</button>
          </form>
        </Modal>
      )}

      {selected && renewing && (
        <Modal title="Renew Plan" onClose={()=>setRenewing(false)}>
          <form onSubmit={submitRenew}>
            <p style={{fontSize:13, color:'var(--steel)', marginBottom:14}}>
              Renew <b>{selected.name}</b>'s membership. A paid transaction will be recorded.
            </p>
            <Field label="Plan">
              <Select value={renewPlan} onChange={setRenewPlan}>
                {plans.map(p=><option key={p.name}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Payment Method">
              <Select value={renewMethod} onChange={setRenewMethod}>
                {['GCash','Card','Cash'].map(m=><option key={m}>{m}</option>)}
              </Select>
            </Field>
            <button className="btn btn-signal btn-block" type="submit">Confirm Renewal — {peso((plans.find(p=>p.name===renewPlan)||{}).price||0)}</button>
          </form>
        </Modal>
      )}

      {pendingFreeze && (
        <Modal title="Freeze Account?" onClose={()=>setPendingFreeze(null)}>
          <p style={{fontSize:13, color:'var(--steel)', marginBottom:14}}>
            You're about to freeze <b>{pendingFreeze.name}</b>. They won't be able to check in or renew until unfrozen.
          </p>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button className="btn btn-outline" type="button" onClick={()=>setPendingFreeze(null)}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={applyFreeze}>Freeze</button>
          </div>
        </Modal>
      )}

      {pendingUnfreeze && (
        <Modal title="Unfreeze Account?" onClose={()=>setPendingUnfreeze(null)}>
          <p style={{fontSize:13, color:'var(--steel)', marginBottom:14}}>
            You're about to unfreeze <b>{pendingUnfreeze.name}</b>. Their access will be restored.
          </p>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button className="btn btn-outline" type="button" onClick={()=>setPendingUnfreeze(null)}>Cancel</button>
            <button className="btn btn-signal" type="button" onClick={applyUnfreeze}>Unfreeze</button>
          </div>
        </Modal>
      )}

      {pendingRemove && (
        <Modal title="Remove Member?" onClose={()=>setPendingRemove(null)}>
          <p style={{fontSize:13, color:'var(--steel)', marginBottom:14}}>
            You're about to remove <b>{pendingRemove.name}</b>. They will be archived and
            hidden from the directory. A super admin can restore or permanently delete them later.
          </p>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button className="btn btn-outline" type="button" onClick={()=>setPendingRemove(null)}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={applyRemove}>Remove</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default AdminMembers;