// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, Field, Select } from '../shared';
import { peso } from '../data.ts';

function StaffPOS({ transactions, setTransactions, members, plans, toast }) {
  const [cart, setCart] = useState([]);
  const [method, setMethod] = useState('GCash');
  const [memberId, setMemberId] = useState(members[0]?.id || '');
  const items = (plans || [])
    .filter(p => p.status !== 'Inactive')
    .map(p => ({ id: 'PLAN-'+p.name, name: p.name + ' Membership', price: p.price }));
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

export default StaffPOS;
