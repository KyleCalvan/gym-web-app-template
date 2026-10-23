// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, Table, Badge, Modal, Field, TextInput, Select, Avatar } from '../shared';
import { createCheckIn, createMember, createMembership, ApiError } from '../lib/api-client.ts';

function StaffMembers({ members, setMembers, plans, setCheckIns, today, toast, addAudit }) {
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('All');
  const [showRegister, setShowRegister] = useState(false);
  const [reg, setReg] = useState({name:'', email:'', phone:'', plan:'Premium'});

  const submitRegister = async (e) => {
    e.preventDefault();
    if (!reg.name.trim() || !reg.email.trim()) { toast('Name and email are required'); return; }
    try {
      const created = await createMember({
        name: reg.name.trim(),
        email: reg.email.trim(),
        phone: reg.phone.trim() || undefined,
      });
      if (reg.plan) {
        try {
          await createMembership(created.id, { planName: reg.plan });
        } catch (error) {
          toast('Member created, but membership assignment failed — ' + (error instanceof Error ? error.message : 'unknown error'));
        }
      }
      setMembers(prev => [...prev, created]);
      toast('Member registered — ' + created.name + ' (' + created.id + ')');
      addAudit?.('info', 'Member registered', created.name + ' (' + created.id + ')');
      setReg({name:'', email:'', phone:'', plan:'Premium'});
      setShowRegister(false);
    } catch (error) {
      toast('Registration failed — ' + (error instanceof Error ? error.message : 'unknown error'));
    }
  };

  const checkIn = async (m) => {
    if (m.status === 'Frozen') { toast('Frozen accounts cannot check in'); return; }
    try {
      await createCheckIn(m.id);
      setCheckIns(c => ({...c, count: c.count + 1}));
      toast(m.name + ' checked in');
      addAudit?.('info', 'Member checked in', m.name + ' (' + m.id + ')');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast(m.name + ' is already checked in today');
        return;
      }
      toast('Check-in failed — ' + (error instanceof Error ? error.message : 'unknown error'));
    }
  };

  const isRegisteredMember = (m) => !m.deletedAt && Number(String(m?.id || '').replace(/\D/g, '')) >= 1042;
  const filtered = members
    .filter(isRegisteredMember)
    .filter(m =>
      (statusF==='All' || m.status===statusF) &&
      (m.name.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase()))
    );

  return (
    <>
      <TabbedCard title="Member Lookup" right={<button className="btn btn-signal btn-sm" onClick={()=>setShowRegister(true)}>+ Register Member</button>}>
        <div className="search-row">
          <TextInput placeholder="Search name or member ID…" value={q} onChange={setQ} />
          <Select value={statusF} onChange={setStatusF} style={{maxWidth:180}}>
            {['All','Active','Expiring','Frozen','Expired'].map(s=><option key={s}>{s}</option>)}
          </Select>
        </div>
        <Table columns={['Member','Plan','Status','Joined','']} rows={filtered} renderRow={m=>(
          <tr key={m.id}>
            <td><Avatar src={m.avatarUrl} name={m.name} />{m.name}<div className="mono" style={{fontSize:11.6, color:'var(--steel)'}}>{m.id}</div></td>
            <td>{m.plan}</td><td><Badge status={m.status}/></td><td className="mono">{m.joined}</td>
            <td>
              <button
                className="btn btn-ghost btn-sm"
                onClick={()=>checkIn(m)}
                disabled={m.status === 'Frozen'}
                title={m.status === 'Frozen' ? 'Frozen accounts cannot check in' : ''}
              >
                Check In
              </button>
            </td>
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
