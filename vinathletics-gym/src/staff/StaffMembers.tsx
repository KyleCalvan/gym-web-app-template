// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, Table, Badge, Modal, Field, TextInput, Select } from '../shared';
import { INITIALS } from '../data.ts';

function StaffMembers({ members, setMembers, plans, setCheckIns, today, toast }) {
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('All');
  const [showRegister, setShowRegister] = useState(false);
  const [reg, setReg] = useState({name:'', email:'', phone:'', plan:'Premium'});

  const submitRegister = (e) => {
    e.preventDefault();
    if (!reg.name.trim() || !reg.email.trim()) { toast('Name and email are required'); return; }
    const id = 'M-' + (1042 + members.length);
    setMembers(prev => [...prev, {...reg, id, status:'Active', joined: today}]);
    toast('Member registered — ' + reg.name + ' (' + id + ')');
    setReg({name:'', email:'', phone:'', plan:'Premium'});
    setShowRegister(false);
  };

  const checkIn = (m) => {
    setCheckIns(c => ({...c, count: c.count + 1}));
    toast(m.name + ' checked in');
  };

  const filtered = members.filter(m =>
    (statusF==='All' || m.status===statusF) &&
    (m.name.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <>
      <TabbedCard label="Members" title="Member Lookup" right={<button className="btn btn-signal btn-sm" onClick={()=>setShowRegister(true)}>+ Register Member</button>}>
        <div className="search-row">
          <TextInput placeholder="Search name or member ID…" value={q} onChange={setQ} />
          <Select value={statusF} onChange={setStatusF} style={{maxWidth:180}}>
            {['All','Active','Expiring','Frozen','Expired'].map(s=><option key={s}>{s}</option>)}
          </Select>
        </div>
        <Table columns={['Member','Plan','Status','Joined','']} rows={filtered} renderRow={m=>(
          <tr key={m.id}>
            <td><span className="avatar-sm">{INITIALS(m.name)}</span>{m.name}<div className="mono" style={{fontSize:10.5, color:'var(--steel)'}}>{m.id}</div></td>
            <td>{m.plan}</td><td><Badge status={m.status}/></td><td className="mono">{m.joined}</td>
            <td><button className="btn btn-ghost btn-sm" onClick={()=>checkIn(m)}>Check In</button></td>
          </tr>
        )} />
      </TabbedCard>

      {showRegister && (
        <Modal title="Register Member" onClose={()=>setShowRegister(false)}>
          <form onSubmit={submitRegister}>
            <Field label="Full Name"><TextInput required value={reg.name} onChange={v=>setReg(r=>({...r, name:v}))} placeholder="Full name" /></Field>
            <Field label="Email"><TextInput type="email" required value={reg.email} onChange={v=>setReg(r=>({...r, email:v}))} placeholder="Email" /></Field>
            <Field label="Phone"><TextInput value={reg.phone} onChange={v=>setReg(r=>({...r, phone:v}))} placeholder="+63 9XX XXX XXXX" /></Field>
            <Field label="Plan">
              <Select value={reg.plan} onChange={v=>setReg(r=>({...r, plan:v}))}>
                {plans.map(p=><option key={p.name}>{p.name}</option>)}
              </Select>
            </Field>
            <button className="btn btn-signal btn-block" type="submit">Register Member</button>
          </form>
        </Modal>
      )}
    </>
  );
}

export default StaffMembers;
