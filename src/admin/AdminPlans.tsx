// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, Modal, Field, TextInput, Select } from '../shared';
import { peso } from '../data.ts';

function AdminPlans({ plans, setPlans, toast }){
  const [form, setForm] = useState({name:'', price:'', cycle:'Monthly', perks:''});
  const [editingPlan, setEditingPlan] = useState(null);

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
        right={<button className="btn btn-signal btn-sm" onClick={openCreate}>+ Create Plan</button>}
      >
        <div style={{fontSize:13, color:'var(--steel)', padding:'4px 0'}}>
          Click <b>+ Create Plan</b> to add a new membership tier, or use the <b>Edit Plan</b> button on any card above to update an existing one.
        </div>
      </TabbedCard>

      {editingPlan && (
        <Modal title={editingPlan.mode === 'edit' ? `Edit Plan — ${editingPlan.plan.name}` : 'Create Plan'} showCloseButton={false} onClose={closeModal} wide>
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
              <button className="btn btn-signal" type="submit">{editingPlan.mode === 'edit' ? 'Save Changes' : 'Create Plan'}</button>
              <button className="btn btn-outline" type="button" onClick={closeModal}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default AdminPlans;