import { useState } from 'react';
import {
  TabbedCard, StatTile, Badge, BarChart, Donut, Table, Modal,
  Field, TextInput, Select, downloadCSV,
} from '../components.jsx';
import {
  REVENUE_TREND, REVENUE_7D, REVENUE_SOURCE, MEMBERSHIP_DIST,
  INITIALS, peso,
} from '../data.js';

export const ADMIN_NAV = [
  {section:'Main', items:[
    {id:'dashboard', label:'Dashboard', ic:'▤'},
  ]},
  {section:'Members', items:[
    {id:'members', label:'Members', ic:'☰'},
    {id:'plans', label:'Membership Plans', ic:'▥'},
  ]},
  {section:'Finance', items:[
    {id:'payments', label:'Payments', ic:'₱'},
    {id:'reports', label:'Revenue & Reports', ic:'▲'},
  ]},
  {section:'Operations', items:[
    {id:'trainers', label:'Trainers', ic:'★'},
    {id:'promotions', label:'Promotions', ic:'◆'},
  ]},
  {section:'Reports', items:[
    {id:'activity', label:'Activity Logs', ic:'≡'},
    {id:'coaching', label:'Coaching Sessions', ic:'●'},
  ]},
];

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
};

function AdminDashboard({ onNav, members, trainers, transactions, sessions, promotions, toast }){
  const published = promotions.filter(p=>p.status==='Published');
  const totalMembers = members.length;
  const activeCount = members.filter(m=>m.status==='Active').length;
  const paid = transactions.filter(t=>t.status==='Paid');
  const revenueMtd = paid.reduce((a,t)=>a+t.amount,0);
  const activeTrainers = trainers.filter(t=>t.status==='Active').length;
  const today = new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
  const sessionsToday = sessions.filter(s=>s.date===today).length;

  const exportReport = () => {
    const rows = [
      ['Members'],
      ['ID','Name','Email','Phone','Plan','Status','Joined'],
      ...members.map(m => [m.id, m.name, m.email, m.phone, m.plan, m.status, m.joined]),
      [],
      ['Transactions'],
      ['ID','Member','Type','Amount','Method','Date','Status'],
      ...transactions.map(t => [t.id, t.member, t.type, t.amount, t.method, t.date, t.status]),
      [],
      ['Sessions'],
      ['ID','Member','Trainer','Date','Time','Type','Status'],
      ...sessions.map(s => [s.id, s.member, s.trainer, s.date, s.time, s.type, s.status]),
    ];
    downloadCSV('vinathletics-report-' + today.replace(/[ ,]/g,'-') + '.csv', rows);
    toast('Report exported as CSV');
  };

  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Total Members" value={totalMembers} delta={`${activeCount} active`} />
        <StatTile label="Revenue (MTD)" value={peso(revenueMtd)} delta={`${paid.length} paid txns`} tone="court" />
        <StatTile label="Active Trainers" value={activeTrainers} delta={`${trainers.length-activeTrainers} on leave/inactive`} tone="amber" />
        <StatTile label="Sessions Today" value={sessionsToday} delta={`${sessions.filter(s=>s.status==='Pending').length} pending`} tone="steel" />
      </div>

      <div className="grid grid-2-1" style={{marginBottom:18, alignItems:'start'}}>
        <TabbedCard label="Finance" title="Recent Transactions" right={<button className="btn btn-outline btn-sm" onClick={()=>onNav && onNav('payments')}>View All</button>}>
          <Table columns={['ID','Member','Type','Amount','Status']} rows={transactions.slice(0,5)} renderRow={t=>(
            <tr key={t.id}>
              <td className="mono">{t.id}</td>
              <td>{t.member}</td>
              <td>{t.type}</td>
              <td className="mono">{peso(t.amount)}</td>
              <td><Badge status={t.status} /></td>
            </tr>
          )} />
        </TabbedCard>

        <TabbedCard label="Quick" title="Quick Actions">
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            <button className="btn btn-signal btn-block" onClick={()=>onNav && onNav('members')}>+ Register Member</button>
            <button className="btn btn-outline btn-block" onClick={()=>onNav && onNav('trainers')}>+ Add Trainer</button>
            <button className="btn btn-outline btn-block" onClick={()=>onNav && onNav('promotions')}>Create Promotion</button>
            <button className="btn btn-outline btn-block" onClick={exportReport}>Export Report</button>
          </div>
        </TabbedCard>
      </div>

      <div className="grid grid-2" style={{marginBottom:18}}>
        <TabbedCard label="Finance" title="Revenue — Last 7 Days">
          <BarChart data={REVENUE_7D} valueKey="v" labelKey="d" prefix="₱" />
        </TabbedCard>
        <TabbedCard label="Members" title="Membership Distribution">
          <Donut data={MEMBERSHIP_DIST} />
        </TabbedCard>
      </div>

      <TabbedCard
        label="Operations"
        title="Promotional Management"
        right={<button className="btn btn-signal btn-sm" onClick={()=>onNav && onNav('promotions')}>+ Create Promotion</button>}
      >
        {published.length === 0 ? (
          <div style={{fontSize:12.5, color:'var(--steel)', padding:'8px 0'}}>No active promotions. Create or publish one to see it here.</div>
        ) : published.map(p=>(
          <div className="promo-widget-row" key={p.id}>
            <div>
              <b>{p.title}</b>
              <div className="mono" style={{fontSize:11, color:'var(--steel)'}}>{p.code} · {p.discount} · valid thru {p.validUntil}</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <span className="mono" style={{fontSize:12, color:'var(--steel)'}}>{p.redemptions}/{p.maxRedemptions} redeemed</span>
              <Badge status={p.status}/>
            </div>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{marginTop:10}} onClick={()=>onNav && onNav('promotions')}>Manage all promotions →</button>
      </TabbedCard>
    </>
  );
}

function AdminMembers({ members, setMembers, plans, transactions, setTransactions, today, toast }){
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('All');
  const [showRegister, setShowRegister] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);

  // Register form
  const [reg, setReg] = useState({name:'', email:'', phone:'', plan:'Basic'});
  const submitRegister = (e) => {
    e.preventDefault();
    if (!reg.name.trim() || !reg.email.trim()) { toast('Name and email are required'); return; }
    const id = 'M-' + (1042 + members.length);
    setMembers(prev => [...prev, {...reg, id, status:'Active', joined: today}]);
    toast('Member registered — ' + reg.name + ' (' + id + ')');
    setReg({name:'', email:'', phone:'', plan:'Basic'});
    setShowRegister(false);
  };

  // Edit form
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
  };

  // Renew plan
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
  };

  const freezeAccount = () => {
    setMembers(prev => prev.map(m => m.id===selected.id ? {...m, status:'Frozen'} : m));
    setSelected(s => ({...s, status:'Frozen'}));
    toast('Account frozen — ' + selected.name);
  };

  const filtered = members.filter(m =>
    (statusF==='All' || m.status===statusF) &&
    (m.name.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase()))
  );

  const counts = {
    active: members.filter(m=>m.status==='Active').length,
    expiring: members.filter(m=>m.status==='Expiring').length,
    ef: members.filter(m=>m.status==='Expired' || m.status==='Frozen').length,
  };

  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Total Members" value={members.length} tone="steel"/>
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
            <td><span className="avatar-sm">{INITIALS(m.name)}</span>{m.name}<div className="mono" style={{fontSize:10.5, color:'var(--steel)'}}>{m.id}</div></td>
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
            <span className="avatar-sm" style={{width:44, height:44, fontSize:15}}>{INITIALS(selected.name)}</span>
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
            <button className="btn btn-outline btn-sm" onClick={()=>setRenewing(true)}>Renew Plan</button>
            <button className="btn btn-danger btn-sm" onClick={freezeAccount} disabled={selected.status==='Frozen'}>Freeze Account</button>
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
    </>
  );
}

function AdminPlans({ plans, setPlans, toast }){
  const [form, setForm] = useState({name:'', price:'', cycle:'Monthly', perks:''});
  const [editingPlan, setEditingPlan] = useState(null); // null = closed; {mode, plan} when open

  const deactivate = (name) => {
    setPlans(prev => prev.map(p => p.name===name ? {...p, members:0, status:'Inactive'} : p));
    toast(name + ' deactivated');
  };
  const activate = (name) => {
    setPlans(prev => prev.map(p => p.name===name ? {...p, status:'Active', members: Math.max(p.members, 1)} : p));
    toast(name + ' reactivated');
  };

  const openCreate = () => {
    setForm({name:'', price:'', cycle:'Monthly', perks:''});
    setEditingPlan({mode:'create'});
  };

  const openEdit = (p) => {
    setForm({
      name: p.name,
      price: String(p.price),
      cycle: p.period === 'yr' ? 'Annual' : (p.period === 'qtr' ? 'Quarterly' : 'Monthly'),
      perks: p.perks.join(', '),
    });
    setEditingPlan({mode:'edit', plan: p});
  };

  const closeModal = () => setEditingPlan(null);

  const submitPlan = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) { toast('Name and price are required'); return; }
    const data = {
      name: form.name.trim(),
      price: Number(form.price),
      period: form.cycle === 'Annual' ? 'yr' : (form.cycle === 'Quarterly' ? 'qtr' : 'mo'),
      perks: form.perks.split(',').map(s=>s.trim()).filter(Boolean),
    };
    if (editingPlan && editingPlan.mode === 'edit') {
      const original = editingPlan.plan.name;
      setPlans(prev => prev.map(p => p.name === original ? { ...p, ...data } : p));
      toast('Plan updated — ' + data.name);
    } else {
      const newPlan = { ...data, members: 0, featured: false, status: 'Active' };
      setPlans(prev => [...prev, newPlan]);
      toast('Plan created — ' + newPlan.name);
    }
    closeModal();
  };
  return (
    <>
      <div className="grid grid-3" style={{marginBottom:22}}>
        {plans.map(p=>{
          const isFeatured = p.featured;
          const isInactive = p.status === 'Inactive';
          return (
            <div className={"plan-card"+(isFeatured?' featured':'')} key={p.name} style={isInactive?{opacity:.55}:undefined}>
              {isFeatured && <span className="ribbon">Most Popular</span>}
              <div className="eyebrow" style={{color:isFeatured?'#9FB0A6':'var(--steel)'}}>{p.members} active members{p.status?` · ${p.status}`:''}</div>
              <h3 style={{fontSize:20}}>{p.name}</h3>
              <div className="price">{peso(p.price)}<span>/{p.period}</span></div>
              <ul>{p.perks.map((perk,i)=><li key={i}>✓ {perk}</li>)}</ul>
              <div style={{display:'flex', gap:8}}>
                <button className={"btn btn-sm "+(isFeatured?'btn-signal':'btn-outline')} onClick={()=>openEdit(p)}>Edit Plan</button>
                {isInactive
                  ? <button className="btn btn-ghost btn-sm" style={{color:isFeatured?'#fff':undefined}} onClick={()=>activate(p.name)}>Reactivate</button>
                  : <button className="btn btn-ghost btn-sm" style={{color:isFeatured?'#fff':undefined}} onClick={()=>deactivate(p.name)}>Deactivate</button>
                }
              </div>
            </div>
          );
        })}
      </div>
      <TabbedCard
        label="Plans"
        title="Plan Management"
        right={
          <button className="btn btn-signal btn-sm" onClick={openCreate}>+ Create Plan</button>
        }
      >
        <div style={{fontSize:13, color:'var(--steel)', padding:'4px 0'}}>
          Click <b>+ Create Plan</b> to add a new membership tier, or use the <b>Edit Plan</b> button on any card above to update an existing one.
        </div>
      </TabbedCard>

      {editingPlan && (
        <Modal
          title={editingPlan.mode === 'edit' ? `Edit Plan — ${editingPlan.plan.name}` : 'Create Plan'}
          onClose={closeModal}
          wide
        >
          <form onSubmit={submitPlan}>
            <div className="grid grid-3">
              <Field label="Plan Name"><TextInput required placeholder="e.g. Student" value={form.name} onChange={v=>setForm(f=>({...f, name:v}))} /></Field>
              <Field label="Price (₱ / period)"><TextInput type="number" required placeholder="1999" value={form.price} onChange={v=>setForm(f=>({...f, price:v}))} /></Field>
              <Field label="Billing Cycle">
                <Select value={form.cycle} onChange={v=>setForm(f=>({...f, cycle:v}))}>
                  <option>Monthly</option><option>Quarterly</option><option>Annual</option>
                </Select>
              </Field>
            </div>
            <Field label="Perks (comma separated)"><TextInput placeholder="Gym floor access, Locker access…" value={form.perks} onChange={v=>setForm(f=>({...f, perks:v}))} /></Field>
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-signal" type="submit">
                {editingPlan.mode === 'edit' ? 'Save Changes' : 'Create Plan'}
              </button>
              <button className="btn btn-outline" type="button" onClick={closeModal}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function AdminPayments({ transactions, setTransactions, today, toast }){
  const [showRefund, setShowRefund] = useState(null);
  const [reason, setReason] = useState('');
  const [showReceipts, setShowReceipts] = useState(false);
  const [viewTxn, setViewTxn] = useState(null);

  const confirmRefund = () => {
    if (!showRefund) return;
    setTransactions(prev => prev.map(t => t.id===showRefund.id ? {...t, status:'Refunded', reason} : t));
    toast('Transaction ' + showRefund.id + ' refunded — ' + peso(showRefund.amount));
    setReason('');
    setShowRefund(null);
  };

  const paid = transactions.filter(t=>t.status==='Paid');
  const todayRevenue = transactions.filter(t=>t.date===today && t.status==='Paid').reduce((a,t)=>a+t.amount,0);
  const pendingCount = transactions.filter(t=>t.status==='Pending').length;
  const refundedMtd = transactions.filter(t=>t.status==='Refunded').reduce((a,t)=>a+t.amount,0);

  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Today's Revenue" value={peso(todayRevenue)} tone="court"/>
        <StatTile label="Transactions Today" value={transactions.filter(t=>t.date===today).length}/>
        <StatTile label="Pending" value={pendingCount} tone="amber"/>
        <StatTile label="Refunded (MTD)" value={peso(refundedMtd)} tone="steel"/>
      </div>
      <TabbedCard label="Finance" title="All Transactions" right={<button className="btn btn-outline btn-sm" onClick={()=>setShowReceipts(true)}>Generate Receipt</button>}>
        <Table columns={['ID','Member','Type','Amount','Method','Date','Status','']} rows={transactions} renderRow={t=>(
          <tr key={t.id}>
            <td className="mono">{t.id}</td>
            <td>{t.member}</td>
            <td>{t.type}</td>
            <td className="mono">{peso(t.amount)}</td>
            <td>{t.method}</td>
            <td className="mono">{t.date}</td>
            <td><Badge status={t.status}/></td>
            <td style={{display:'flex', gap:6}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setViewTxn(t)}>View</button>
              {t.status==='Paid' && <button className="btn btn-ghost btn-sm" onClick={()=>{setShowRefund(t); setReason('');}}>Refund</button>}
            </td>
          </tr>
        )} />
      </TabbedCard>

      {showRefund && (
        <Modal title="Refund / Void Transaction" onClose={()=>setShowRefund(null)}>
          <p style={{fontSize:13, color:'var(--steel)', marginBottom:14}}>You are about to refund <b className="mono">{showRefund.id}</b> — {peso(showRefund.amount)} paid by {showRefund.member}.</p>
          <Field label="Reason"><textarea className="form-control" rows="3" placeholder="Reason for refund…" value={reason} onChange={e=>setReason(e.target.value)} /></Field>
          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-danger" onClick={confirmRefund}>Confirm Refund</button>
            <button className="btn btn-outline" onClick={()=>setShowRefund(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {showReceipts && (
        <Modal title="Generate Receipt" onClose={()=>setShowReceipts(false)}>
          <p style={{fontSize:12.5, color:'var(--steel)', marginBottom:10}}>Pick a recent paid transaction to view/print a receipt.</p>
          {paid.length === 0 ? (
            <div style={{fontSize:13, color:'var(--steel)'}}>No paid transactions available.</div>
          ) : (
            <Table columns={['ID','Member','Amount','Method','']} rows={paid.slice(0,8)} renderRow={t=>(
              <tr key={t.id}>
                <td className="mono">{t.id}</td>
                <td>{t.member}</td>
                <td className="mono">{peso(t.amount)}</td>
                <td>{t.method}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={()=>{setViewTxn(t); setShowReceipts(false);}}>Open →</button></td>
              </tr>
            )} />
          )}
        </Modal>
      )}

      {viewTxn && (
        <Modal title="Receipt" onClose={()=>setViewTxn(null)}>
          <div className="receipt">
            <div style={{textAlign:'center', fontFamily:'var(--font-display)', fontSize:15}}>🏋 VINATHLETICS GYM</div>
            <div style={{textAlign:'center', fontSize:10.5, color:'var(--steel)'}}>Official Receipt · {viewTxn.id}</div>
            <hr/>
            <div className="row"><span>{viewTxn.type}</span><span>{peso(viewTxn.amount)}</span></div>
            <div className="row"><span>Member</span><span>{viewTxn.member}</span></div>
            <div className="row"><span>Method</span><span>{viewTxn.method}</span></div>
            <div className="row"><span>Date</span><span>{viewTxn.date}</span></div>
            <hr/>
            <div className="row" style={{fontWeight:700}}><span>TOTAL</span><span>{peso(viewTxn.amount)}</span></div>
          </div>
          <button className="btn btn-outline btn-sm btn-block" style={{marginTop:14}} onClick={()=>{window.print(); toast('Print dialog opened');}}>Download PDF</button>
        </Modal>
      )}
    </>
  );
}

function AdminReports({ members, transactions, sessions, today, toast }){
  const [dateRange, setDateRange] = useState('Last 7 Days');
  const [category, setCategory] = useState('All');
  const [branch, setBranch] = useState('Main Branch');
  const [applied, setApplied] = useState(null);

  const exportCsv = () => {
    const rows = [
      ['Report — VinAthletics Gym'],
      ['Generated', today],
      ['Filters', applied ? `${applied.dateRange} · ${applied.category} · ${applied.branch}` : 'None'],
      [],
      ['Members'], ['ID','Name','Plan','Status','Joined'],
      ...members.map(m => [m.id, m.name, m.plan, m.status, m.joined]),
      [],
      ['Transactions'], ['ID','Member','Type','Amount','Method','Date','Status'],
      ...transactions.map(t => [t.id, t.member, t.type, t.amount, t.method, t.date, t.status]),
    ];
    downloadCSV('vinathletics-report-' + today.replace(/[ ,]/g,'-') + '.csv', rows);
    toast('Report exported as CSV');
  };
  const exportPdf = () => {
    toast('Print dialog opened for PDF export');
    setTimeout(()=>window.print(), 80);
  };
  const apply = () => {
    setApplied({dateRange, category, branch});
    toast('Filters applied — ' + dateRange + ' · ' + category + ' · ' + branch);
  };

  return (
    <>
      <div className="grid grid-2" style={{marginBottom:18}}>
        <TabbedCard label="Trends" title="Revenue Trend — Last 6 Months">
          <BarChart data={REVENUE_TREND} valueKey="v" labelKey="m" prefix="₱" />
        </TabbedCard>
        <TabbedCard label="Breakdown" title="Revenue by Source">
          <Donut data={REVENUE_SOURCE} />
        </TabbedCard>
      </div>
      <div className="grid grid-2-1">
        <TabbedCard label="Filter" title="Filter Reports">
          <div className="grid grid-3">
            <Field label="Date Range">
              <Select value={dateRange} onChange={setDateRange}>
                <option>Last 7 Days</option><option>Last 30 Days</option><option>Last 6 Months</option>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={category} onChange={setCategory}>
                <option>All</option><option>Memberships</option><option>PT Sessions</option><option>POS</option>
              </Select>
            </Field>
            <Field label="Branch">
              <Select value={branch} onChange={setBranch}>
                <option>Main Branch</option><option>Downtown</option><option>BGC</option>
              </Select>
            </Field>
          </div>
          {applied && <div style={{fontSize:11.5, color:'var(--steel)', marginBottom:10}}>Applied: <span className="mono">{applied.dateRange} · {applied.category} · {applied.branch}</span></div>}
          <button className="btn btn-signal btn-sm" onClick={apply}>Apply Filters</button>
        </TabbedCard>
        <TabbedCard label="Export" title="Export Reports">
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            <button className="btn btn-outline btn-block" onClick={exportCsv}>Export as CSV</button>
            <button className="btn btn-outline btn-block" onClick={exportPdf}>Export as PDF</button>
          </div>
        </TabbedCard>
      </div>
    </>
  );
}

function AdminTrainers({ trainers, setTrainers, members, sessions, setSessions, today, toast }){
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

function AdminPromotions({ promotions, setPromotions, plans, toast }){
  const [form, setForm] = useState({
    title:'', discountType:'Percentage', discountValue:'', validFrom:'', validUntil:'',
    applicablePlan:'Any Plan', description:'', maxRedemptions:'', minSpend:'', code:'',
  });
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [pubForm, setPubForm] = useState({promoId:'', action:'Publish'});
  const [showCreate, setShowCreate] = useState(false);
  const [detailPromo, setDetailPromo] = useState(null);

  const togglePublish = (id) => {
    setPromotions(prev => prev.map(p => p.id===id ? {...p, status: p.status==='Published' ? 'Draft' : 'Published'} : p));
    toast('Promotion status updated');
  };

  const submitNew = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.validFrom || !form.validUntil) { toast('Title and validity dates required'); return; }
    const id = 'PROMO-0' + (promotions.length + 1);
    const fromISO = new Date(form.validFrom);
    const untilISO = new Date(form.validUntil);
    const validFrom = isNaN(fromISO) ? form.validFrom : formatDate(form.validFrom);
    const validUntil = isNaN(untilISO) ? form.validUntil : formatDate(form.validUntil);
    const newPromo = {
      id, title: form.title.trim(),
      discountType: form.discountType, discount: form.discountValue || 'Custom',
      validFrom, validUntil, plan: form.applicablePlan,
      code: form.code || ('AUTO' + Date.now().toString().slice(-5)),
      maxRedemptions: Number(form.maxRedemptions) || 0,
      redemptions: 0,
      minSpend: Number(form.minSpend) || 0,
      status: 'Draft',
    };
    setPromotions(prev => [...prev, newPromo]);
    toast('Promotion created — ' + newPromo.title);
    setForm({title:'', discountType:'Percentage', discountValue:'', validFrom:'', validUntil:'', applicablePlan:'Any Plan', description:'', maxRedemptions:'', minSpend:'', code:''});
    setShowCreate(false);
  };

  const startEdit = (p) => {
    setEditing(p);
    setEditForm({title:p.title, discountType:p.discountType, discount:p.discount, code:p.code, validUntil:p.validUntil});
  };
  const submitEdit = (e) => {
    e.preventDefault();
    setPromotions(prev => prev.map(p => p.id===editing.id ? {...p, ...editForm} : p));
    toast('Promotion updated — ' + editForm.title);
    setEditing(null); setEditForm(null);
  };

  const applyPub = () => {
    if (!pubForm.promoId) { toast('Pick a promotion'); return; }
    const target = promotions.find(p => p.id === pubForm.promoId);
    if (!target) return;
    const nextStatus = pubForm.action === 'Publish' ? 'Published' : 'Draft';
    setPromotions(prev => prev.map(p => p.id===pubForm.promoId ? {...p, status:nextStatus} : p));
    toast(pubForm.action + ' applied to ' + target.title);
  };

  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Total Promotions" value={promotions.length} />
        <StatTile label="Published" value={promotions.filter(p=>p.status==='Published').length} tone="court" />
        <StatTile label="Drafts" value={promotions.filter(p=>p.status==='Draft').length} tone="amber" />
        <StatTile label="Total Redemptions" value={promotions.reduce((a,p)=>a+p.redemptions,0)} tone="steel" />
      </div>

      {/* Resource management panel — matches the See Resources card pattern. */}
      <TabbedCard
        label="Operations"
        title="Promotion Resources"
        right={
          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-outline btn-sm" onClick={()=>setShowCreate(true)}>+ New Promotion</button>
          </div>
        }
      >
        {promotions.length === 0 ? (
          <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>
            No promotion resources yet. Click <b>+ New Promotion</b> to add the first one.
          </div>
        ) : (
          <div className="resource-grid">
            {promotions.map(p=>(
              <div className="resource-card" key={p.id} onClick={()=>setDetailPromo(p)}>
                <div className="head">
                  <div>
                    <div className="ttl">{p.title}</div>
                    <div className="mono" style={{fontSize:10.5, color:'var(--steel)', marginTop:2}}>{p.id} · {p.code}</div>
                  </div>
                  <Badge status={p.status}/>
                </div>
                <div className="desc">
                  {p.discount} off · {p.plan}
                </div>
                <div className="meta">
                  <span className="pill">{p.discount}</span>
                  <span className="pill">{p.plan}</span>
                  <span className="pill">{p.redemptions}/{p.maxRedemptions} used</span>
                </div>
                <div className="foot">
                  <span>Valid until {p.validUntil}</span>
                  <span className="open">See Resources →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabbedCard>

      <div style={{height:18}}></div>

      <TabbedCard label="Operations" title="Bulk Publish / Unpublish">
        <div className="grid grid-3">
          <Field label="Promotion">
            <Select value={pubForm.promoId} onChange={v=>setPubForm(f=>({...f, promoId:v}))}>
              <option value="">Select…</option>
              {promotions.map(p=><option key={p.id} value={p.id}>{p.title} ({p.status})</option>)}
            </Select>
          </Field>
          <Field label="Action">
            <Select value={pubForm.action} onChange={v=>setPubForm(f=>({...f, action:v}))}>
              <option>Publish</option><option>Unpublish</option>
            </Select>
          </Field>
          <div style={{display:'flex', alignItems:'flex-end'}}>
            <button className="btn btn-signal btn-sm" onClick={applyPub}>Apply</button>
          </div>
        </div>
      </TabbedCard>

      {/* Detail modal — opened from "See Resources →" on a card. */}
      {detailPromo && (
        <Modal title={detailPromo.title} onClose={()=>setDetailPromo(null)} wide>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
            <div>
              <div className="eyebrow">Promotion</div>
              <div className="mono" style={{fontSize:13, marginTop:2}}>{detailPromo.id} · {detailPromo.code}</div>
            </div>
            <Badge status={detailPromo.status}/>
          </div>
          <div className="resource-detail-row">
            <span className="lbl">Discount</span>
            <span className="val">{detailPromo.discount} {detailPromo.discountType ? `(${detailPromo.discountType})` : ''}</span>
          </div>
          <div className="resource-detail-row">
            <span className="lbl">Applicable Plan</span>
            <span className="val">{detailPromo.plan}</span>
          </div>
          <div className="resource-detail-row">
            <span className="lbl">Valid From</span>
            <span className="val">{detailPromo.validFrom}</span>
          </div>
          <div className="resource-detail-row">
            <span className="lbl">Valid Until</span>
            <span className="val">{detailPromo.validUntil}</span>
          </div>
          <div className="resource-detail-row">
            <span className="lbl">Min. Spend</span>
            <span className="val">₱{detailPromo.minSpend?.toLocaleString('en-PH') || 0}</span>
          </div>
          <div className="resource-detail-row">
            <span className="lbl">Redemptions</span>
            <span className="val">{detailPromo.redemptions} / {detailPromo.maxRedemptions}</span>
          </div>
          <div style={{display:'flex', gap:8, marginTop:18}}>
            <button className="btn btn-outline btn-sm" onClick={()=>{startEdit(detailPromo); setDetailPromo(null);}}>Edit</button>
            <button className="btn btn-signal btn-sm" onClick={()=>{togglePublish(detailPromo.id); setDetailPromo(p=>({...p, status: p.status==='Published'?'Draft':'Published'}));}}>
              {detailPromo.status === 'Published' ? 'Unpublish' : 'Publish'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setDetailPromo(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* Create promotion modal */}
      {showCreate && (
        <Modal title="New Promotion" onClose={()=>setShowCreate(false)} wide>
          <form onSubmit={submitNew}>
            <div className="grid grid-3">
              <Field label="Promotion Title *"><TextInput required placeholder="e.g. Summer Body Special" value={form.title} onChange={v=>setForm(f=>({...f, title:v}))} /></Field>
              <Field label="Discount Type">
                <Select value={form.discountType} onChange={v=>setForm(f=>({...f, discountType:v}))}>
                  <option>Percentage</option><option>Fixed Amount</option><option>Bundle</option>
                </Select>
              </Field>
              <Field label="Discount Value"><TextInput placeholder="20% or ₱500" value={form.discountValue} onChange={v=>setForm(f=>({...f, discountValue:v}))} /></Field>
            </div>
            <div className="grid grid-3">
              <Field label="Valid From *"><TextInput type="date" required value={form.validFrom} onChange={v=>setForm(f=>({...f, validFrom:v}))} /></Field>
              <Field label="Valid Until *"><TextInput type="date" required value={form.validUntil} onChange={v=>setForm(f=>({...f, validUntil:v}))} /></Field>
              <Field label="Applicable Plan">
                <Select value={form.applicablePlan} onChange={v=>setForm(f=>({...f, applicablePlan:v}))}>
                  <option>Any Plan</option>
                  {plans.map(p=><option key={p.name}>{p.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Description"><textarea className="form-control" rows="2" placeholder="Short description shown to members…" value={form.description} onChange={e=>setForm(f=>({...f, description:e.target.value}))} /></Field>
            <div className="grid grid-3">
              <Field label="Max Redemptions"><TextInput type="number" placeholder="100" value={form.maxRedemptions} onChange={v=>setForm(f=>({...f, maxRedemptions:v}))} /></Field>
              <Field label="Min. Spend"><TextInput type="number" placeholder="0" value={form.minSpend} onChange={v=>setForm(f=>({...f, minSpend:v}))} /></Field>
              <Field label="Promo Code"><TextInput placeholder="SUMMER20" value={form.code} onChange={v=>setForm(f=>({...f, code:v}))} /></Field>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-signal" type="submit">Save Promotion</button>
              <button className="btn btn-outline" type="button" onClick={()=>setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {editing && editForm && (
        <Modal title="Edit Promotion" onClose={()=>{setEditing(null); setEditForm(null);}}>
          <form onSubmit={submitEdit}>
            <Field label="Title"><TextInput required value={editForm.title} onChange={v=>setEditForm(f=>({...f, title:v}))} /></Field>
            <Field label="Discount Type">
              <Select value={editForm.discountType} onChange={v=>setEditForm(f=>({...f, discountType:v}))}>
                <option>Percentage</option><option>Fixed Amount</option><option>Bundle</option>
              </Select>
            </Field>
            <Field label="Discount"><TextInput value={editForm.discount} onChange={v=>setEditForm(f=>({...f, discount:v}))} /></Field>
            <Field label="Promo Code"><TextInput value={editForm.code} onChange={v=>setEditForm(f=>({...f, code:v}))} /></Field>
            <Field label="Valid Until"><TextInput type="date" value={editForm.validUntil} onChange={v=>setEditForm(f=>({...f, validUntil:v}))} /></Field>
            <button className="btn btn-signal btn-block" type="submit">Save Changes</button>
          </form>
        </Modal>
      )}
    </>
  );
}

function AdminActivity(){
  const logs = [
    {who:'Admin User', action:'Registered new member Bea Fernandez', time:'Aug 19, 2026 · 10:42 AM'},
    {who:'Liza Manalo', action:'Processed POS sale TXN-8820', time:'Aug 19, 2026 · 9:15 AM'},
    {who:'James Reyes', action:'Updated availability for next week', time:'Aug 18, 2026 · 6:30 PM'},
    {who:'Admin User', action:'Refunded transaction TXN-8816', time:'Aug 18, 2026 · 3:02 PM'},
    {who:'System', action:'Auto-flagged 3 memberships expiring in 7 days', time:'Aug 18, 2026 · 12:00 AM'},
  ];
  return (
    <TabbedCard label="Reports" title="Activity Logs">
      <Table columns={['User','Action','Timestamp']} rows={logs} renderRow={(l,i)=>(
        <tr key={i}><td>{l.who}</td><td>{l.action}</td><td className="mono">{l.time}</td></tr>
      )} />
    </TabbedCard>
  );
}

function AdminCoaching({ sessions }){
  return (
    <TabbedCard label="Reports" title="Coaching Sessions Overview">
      <Table columns={['ID','Member','Trainer','Date','Time','Type','Status']} rows={sessions} renderRow={s=>(
        <tr key={s.id}>
          <td className="mono">{s.id}</td><td>{s.member}</td><td>{s.trainer}</td>
          <td className="mono">{s.date}</td><td className="mono">{s.time}</td><td>{s.type}</td>
          <td><Badge status={s.status}/></td>
        </tr>
      )} />
    </TabbedCard>
  );
}

export const ADMIN_VIEWS = {
  dashboard:AdminDashboard, members:AdminMembers, plans:AdminPlans, payments:AdminPayments,
  reports:AdminReports, trainers:AdminTrainers, promotions:AdminPromotions, activity:AdminActivity, coaching:AdminCoaching,
};
