// @ts-nocheck
import { useState } from 'react';
import { Badge, TabbedCard, Modal, Field, Select } from '../shared';
import { peso } from '../data.ts';

function MemberMembership({ members, setMembers, plans, setTransactions, currentUserId, today, toast }){
  const me = members.find(m => m.id === currentUserId) || members[0];
  const [showSwitch, setShowSwitch] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [picked, setPicked] = useState(me?.plan || 'Premium');
  const [method, setMethod] = useState('GCash');

  const renew = () => {
    const plan = plans.find(p => p.name === me.plan);
    if (!plan) return;
    setTransactions(prev => [{
      id: 'TXN-' + (8821 + prev.length),
      member: me.name,
      type: 'Membership Renewal (' + me.plan + ')',
      amount: plan.price,
      method,
      date: today,
      status: 'Paid',
    }, ...prev]);
    toast('Membership renewed — ' + peso(plan.price));
    setShowRenew(false);
  };

  const switchPlan = (e) => {
    e.preventDefault();
    if (picked === me.plan) { toast('That is already your current plan'); return; }
    const newPlan = plans.find(p => p.name === picked);
    setMembers(prev => prev.map(m => m.id === me.id ? {...m, plan: picked} : m));
    if (newPlan) {
      setTransactions(prev => [{
        id: 'TXN-' + (8821 + prev.length),
        member: me.name,
        type: 'Plan Switch → ' + picked,
        amount: newPlan.price,
        method,
        date: today,
        status: 'Paid',
      }, ...prev]);
    }
    toast('Switched to ' + picked + ' plan');
    setShowSwitch(false);
  };

  const freeze = () => {
    setMembers(prev => prev.map(m => m.id === me.id ? {...m, status:'Frozen'} : m));
    toast('Membership frozen — ' + me.name);
  };

  return (
    <>
      <div className="plan-card featured" style={{marginBottom:22}}>
        <div className="eyebrow" style={{color:'#9FB0A6'}}>Current Plan</div>
        <div className="price">{me?.plan || 'Premium'}</div>
        <div style={{fontSize:13, color:'#B9C7BF'}}>Renews Sep 12, 2026 · {peso((plans.find(p=>p.name===me?.plan)||{}).price || 2499)}/mo</div>
        <Badge status={me?.status || 'Active'} />
        <div style={{display:'flex', gap:8, marginTop:16}}>
          <button className="btn btn-signal btn-sm" onClick={()=>setShowRenew(true)}>Renew Now</button>
          <button className="btn btn-outline btn-sm" style={{color:'#fff', borderColor:'#fff'}} onClick={()=>setShowSwitch(true)}>Switch Plan</button>
          <button className="btn btn-outline btn-sm" style={{color:'#fff', borderColor:'#fff'}} onClick={freeze} disabled={me?.status==='Frozen'}>Freeze Membership</button>
        </div>
      </div>
      <TabbedCard label="Plans" title="Available Plans">
        <div className="grid grid-3">
          {plans.map(p=>{
            const isCurrent = p.name === me?.plan;
            return (
              <div className={"plan-card"+(p.featured?' featured':'')} key={p.name}>
                {p.featured && <span className="ribbon">Most Popular</span>}
                <h3 style={{fontSize:18}}>{p.name}</h3>
                <div className="price">{peso(p.price)}<span>/{p.period}</span></div>
                <ul>{p.perks.map((perk,i)=><li key={i}>✓ {perk}</li>)}</ul>
                <button className={"btn btn-sm btn-block "+(isCurrent?'btn-outline':'btn-signal')} disabled={isCurrent} onClick={()=>{setPicked(p.name); setShowSwitch(true);}}>
                  {isCurrent ? 'Current Plan' : 'Switch to ' + p.name}
                </button>
              </div>
            );
          })}
        </div>
      </TabbedCard>

      {showRenew && (
        <Modal title="Renew Membership" onClose={()=>setShowRenew(false)}>
          <p style={{fontSize:13, color:'var(--steel)', marginBottom:14}}>Renew your <b>{me?.plan}</b> plan. A paid transaction will be recorded.</p>
          <Field label="Payment Method">
            <Select value={method} onChange={setMethod}>
              <option>GCash</option><option>Card</option><option>Cash</option>
            </Select>
          </Field>
          <button className="btn btn-signal btn-block" onClick={renew}>Confirm Renewal — {peso((plans.find(p=>p.name===me?.plan)||{}).price || 0)}</button>
        </Modal>
      )}

      {showSwitch && (
        <Modal title="Switch Plan" onClose={()=>setShowSwitch(false)}>
          <form onSubmit={switchPlan}>
            <Field label="Pick a Plan">
              <Select value={picked} onChange={setPicked}>
                {plans.map(p=><option key={p.name}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Payment Method">
              <Select value={method} onChange={setMethod}>
                <option>GCash</option><option>Card</option><option>Cash</option>
              </Select>
            </Field>
            <button className="btn btn-signal btn-block" type="submit">Confirm Switch</button>
          </form>
        </Modal>
      )}
    </>
  );
}

export default MemberMembership;