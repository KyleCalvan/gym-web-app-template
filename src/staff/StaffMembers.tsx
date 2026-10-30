// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, Table, Badge, Modal, Field, TextInput, Select, Avatar } from '../shared';

function StaffMembers({ members, plans, toast, onStaffRegisterMember, onStaffCheckIn }) {
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('All');
  const [showRegister, setShowRegister] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const defaultPlan = plans.find((plan) => plan.status === 'Active')?.name || plans[0]?.name || '';
  const [reg, setReg] = useState({name:'', email:'', phone:'', plan: defaultPlan});

  const submitRegister = async (e) => {
    e.preventDefault();
    if (!reg.name.trim() || !reg.email.trim()) { toast('Name and email are required'); return; }
    try {
      const member = await onStaffRegisterMember({ name: reg.name, email: reg.email, phone: reg.phone, planName: reg.plan });
      toast('Member registered — ' + member.name + ' (' + (member.displayId || member.id) + '). Complete payment in Point of Sale.');
      setReg({name:'', email:'', phone:'', plan: defaultPlan});
      setShowRegister(false);
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not register member.'); }
  };

  const checkIn = async (m) => {
    if (m.status === 'Frozen') { toast('Frozen accounts cannot check in'); return; }
    try {
      await onStaffCheckIn(m.id);
      toast(m.name + ' checked in');
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not check in member.'); }
  };

  const isRegisteredMember = (m) => !m.deletedAt;
  const filtered = members
    .filter(isRegisteredMember)
    .filter(m =>
      (statusF==='All' || m.status===statusF) &&
      (m.name.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase())
        || m.displayId?.toLowerCase().includes(q.toLowerCase()))
    );
  const selectedMember = members.find((member) => member.id === selectedMemberId && !member.deletedAt);

  return (
    <>
      <TabbedCard title="Member Lookup" right={<button className="btn btn-signal btn-sm" onClick={()=>setShowRegister(true)}>+ Register Member</button>}>
        <div className="search-row">
          <TextInput placeholder="Search name or member ID…" value={q} onChange={setQ} />
          <Select value={statusF} onChange={setStatusF} style={{maxWidth:180}}>
            {['All','Active','Expiring','Frozen','Expired'].map(s=><option key={s} value={s}>{s === 'Expiring' ? 'Expire' : s}</option>)}
          </Select>
        </div>
        <Table columns={['Member','Plan','Status','Joined','']} rows={filtered} renderRow={m=>(
          <tr key={m.id}>
            <td><Avatar src={m.avatarUrl} name={m.name} />{m.name}<div className="mono" style={{fontSize:11.6, color:'var(--steel)'}}>{m.displayId || m.id}</div></td>
            <td>{m.plan}</td><td><Badge status={m.status}/></td><td className="mono">{m.joined}</td>
            <td>
              <button className="btn btn-outline btn-sm" type="button" onClick={()=>setSelectedMemberId(m.id)}>
                View details
              </button>
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

      {selectedMember && <Modal title="Member details" onClose={()=>setSelectedMemberId(null)}>
        <div className="staff-member-details">
          <div><span>Member ID</span><strong className="mono">{selectedMember.displayId || selectedMember.id}</strong></div>
          <div><span>Name</span><strong>{selectedMember.name}</strong></div>
          <div><span>Email</span><strong>{selectedMember.email}</strong></div>
          <div><span>Phone</span><strong>{selectedMember.phone || 'Not provided'}</strong></div>
          <div><span>Current plan</span><strong>{selectedMember.plan}</strong></div>
          <div><span>Membership status</span><strong><Badge status={selectedMember.status} /></strong></div>
          <div><span>Member since</span><strong>{selectedMember.joined}</strong></div>
          <div><span>Valid until</span><strong>{selectedMember.membershipValidUntil
            ? new Date(selectedMember.membershipValidUntil).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
            : 'No active membership'}</strong></div>
        </div>
        <div className="payment-simulation-actions">
          <button className="btn btn-outline" type="button" onClick={()=>setSelectedMemberId(null)}>Close</button>
        </div>
      </Modal>}

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
