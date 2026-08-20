import { useState } from 'react';
import { TabbedCard, StatTile, Badge, Table, Modal, Field, TextInput, Select } from '../components.jsx';
import { INITIALS, peso } from '../data.js';

export const STAFF_NAV = [
  {section:'Main', items:[{id:'dashboard', label:'Dashboard', ic:'▤'}]},
  {section:'Members', items:[{id:'members', label:'Members', ic:'☰'}]},
  {section:'Finance', items:[{id:'pos', label:'Point of Sale', ic:'₱'}, {id:'transactions', label:'My Transactions', ic:'▲'}]},
  {section:'Operations', items:[{id:'schedules', label:'Trainer Schedules', ic:'●'}]},
];

function StaffDashboard({ checkIns, members, transactions }){
  const todayRevenue = transactions.filter(t => t.date === new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'}) && t.status==='Paid').reduce((a,t)=>a+t.amount,0);
  const newThisMonth = members.filter(m => {
    const d = new Date(m.joined);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const expiring = members.filter(m => m.status === 'Expiring').length;
  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Check-ins Today" value={checkIns.count} tone="court"/>
        <StatTile label="New Sign-ups" value={newThisMonth} tone="amber"/>
        <StatTile label="Pending Renewals" value={expiring} tone="steel"/>
        <StatTile label="Today's Revenue" value={peso(todayRevenue)}/>
      </div>
      <TabbedCard label="Finance" title="Recent Transactions">
        <Table columns={['ID','Member','Type','Amount','Status']} rows={transactions.slice(0,4)} renderRow={t=>(
          <tr key={t.id}><td className="mono">{t.id}</td><td>{t.member}</td><td>{t.type}</td><td className="mono">{peso(t.amount)}</td><td><Badge status={t.status}/></td></tr>
        )} />
      </TabbedCard>
    </>
  );
}

function StaffMembers({ members, setMembers, plans, checkIns, setCheckIns, today, toast }){
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

function StaffPOS({ transactions, setTransactions, members, toast }){
  const [cart, setCart] = useState([]);
  const [method, setMethod] = useState('GCash');
  const [memberId, setMemberId] = useState(members[0]?.id || '');
  const items = [
    {name:'Basic Membership', price:1499},
    {name:'Premium Membership', price:2499},
    {name:'Elite Membership', price:3999},
    {name:'PT Session (1x)', price:900},
    {name:'Protein Shake', price:250},
    {name:'Gym Towel', price:150},
  ];
  const total = cart.reduce((a,c)=>a+c.price,0);
  const member = members.find(m => m.id === memberId) || members[0];

  const charge = () => {
    if (cart.length === 0) { toast('Cart is empty'); return; }
    const txnId = 'TXN-' + (8821 + transactions.length);
    const memberName = member ? member.name : 'Walk-in';
    const today = new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
    const type = cart.length === 1 ? cart[0].name : (cart.length + ' items');
    setTransactions(prev => [{
      id: txnId, member: memberName, type, amount: total, method, date: today, status: 'Paid',
    }, ...prev]);
    toast('Sale completed — ' + peso(total) + ' (' + txnId + ')');
    setCart([]);
  };

  return (
    <div className="grid grid-2-1">
      <TabbedCard label="POS" title="New Sale">
        <div className="grid grid-3">
          {items.map((it,i)=>(
            <button key={i} className="card" style={{textAlign:'left', border:'1.5px solid var(--line)'}} onClick={()=>setCart([...cart, it])}>
              <div style={{fontSize:13, fontWeight:600}}>{it.name}</div>
              <div className="mono" style={{color:'var(--signal)', marginTop:6}}>{peso(it.price)}</div>
            </button>
          ))}
        </div>
      </TabbedCard>
      <TabbedCard label="Cart" title="Receipt">
        <Field label="Member">
          <Select value={memberId} onChange={setMemberId}>
            {members.map(m=><option key={m.id} value={m.id}>{m.name} ({m.id})</option>)}
          </Select>
        </Field>
        <Field label="Payment Method">
          <Select value={method} onChange={setMethod}>
            <option>GCash</option><option>Card</option><option>Cash</option>
          </Select>
        </Field>
        <div className="receipt">
          <div style={{textAlign:'center', fontFamily:'var(--font-display)', fontSize:15}}>🏋 VINATHLETICS GYM</div>
          <div style={{textAlign:'center', fontSize:10.5, color:'var(--steel)'}}>Official Receipt</div>
          <hr/>
          {cart.length === 0 ? (
            <div style={{fontSize:12, color:'var(--steel)', textAlign:'center', padding:'8px 0'}}>Cart is empty. Tap an item to add.</div>
          ) : cart.map((c,i)=>(<div className="row" key={i}><span>{c.name}</span><span>{peso(c.price)}</span></div>))}
          <hr/>
          <div className="row" style={{fontWeight:700}}><span>TOTAL</span><span>{peso(total)}</span></div>
          {cart.length > 0 && <div style={{marginTop:8, fontSize:11.5, color:'var(--steel)'}}>Method: <b>{method}</b> · Member: <b>{member ? member.name : 'Walk-in'}</b></div>}
        </div>
        <div style={{display:'flex', gap:8, marginTop:14}}>
          <button className="btn btn-signal btn-block" onClick={charge}>Charge {peso(total)}</button>
        </div>
        {cart.length > 0 && <button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={()=>setCart([])}>Clear Cart</button>}
      </TabbedCard>
    </div>
  );
}

function StaffTransactions({ transactions }){
  const today = new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
  const todays = transactions.filter(t => t.date === today);
  const todayTotal = todays.filter(t=>t.status==='Paid').reduce((a,t)=>a+t.amount,0);
  const refunds = transactions.filter(t => t.status==='Refunded').length;
  const [viewTxn, setViewTxn] = useState(null);

  return (
    <>
      <div className="grid grid-3" style={{marginBottom:18}}>
        <StatTile label="Transactions Today" value={todays.length}/>
        <StatTile label="Today's Sales" value={peso(todayTotal)} tone="court"/>
        <StatTile label="Refunds" value={refunds} tone="steel"/>
      </div>
      <TabbedCard label="Finance" title={"My Transactions — Today, " + today}>
        {todays.length === 0 ? (
          <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>No transactions yet today. Use the Point of Sale to record one.</div>
        ) : (
          <Table columns={['ID','Member','Type','Amount','Method','']} rows={todays} renderRow={t=>(
            <tr key={t.id}>
              <td className="mono">{t.id}</td><td>{t.member}</td><td>{t.type}</td><td className="mono">{peso(t.amount)}</td><td>{t.method}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={()=>setViewTxn(t)}>Receipt →</button></td>
            </tr>
          )} />
        )}
      </TabbedCard>

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
          <button className="btn btn-outline btn-sm btn-block" style={{marginTop:14}} onClick={()=>window.print()}>Download PDF</button>
        </Modal>
      )}
    </>
  );
}

function StaffSchedules({ trainers }){
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat'];
  return (
    <TabbedCard label="Ops" title="Weekly Trainer Schedule (View Only)">
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Trainer</th>{days.map(d=><th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {trainers.map(t=>(
              <tr key={t.id}>
                <td>{t.name}<div className="mono" style={{fontSize:10.5, color:'var(--steel)'}}>{t.specialty}</div></td>
                {days.map((d,i)=><td key={i} className="mono" style={{fontSize:11.5}}>{(i+t.id.length)%3===0 ? '—' : '6-9AM, 4-8PM'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TabbedCard>
  );
}

export const STAFF_VIEWS = {
  dashboard:StaffDashboard, members:StaffMembers, pos:StaffPOS, transactions:StaffTransactions, schedules:StaffSchedules,
};
