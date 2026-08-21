import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TabbedCard, StatTile, Badge, BarChart, Table, Modal, Switch, AnimatedStepTrack, Field, TextInput, Select } from '../components.jsx';
import { INITIALS, peso } from '../data.js';
import { dur, ease, stagger, spring } from '../motion.jsx';

export const MEMBER_NAV = [
  {section:'My Account', items:[{id:'dashboard', label:'Dashboard', ic:'▤'}]},
  {section:'Membership', items:[{id:'membership', label:'My Membership', ic:'▥'}]},
  {section:'Training', items:[{id:'coaching', label:'Coaching Sessions', ic:'●'}]},
  {section:'Finance', items:[{id:'payments', label:'My Payments', ic:'₱'}]},
  {section:'Other', items:[{id:'notifications', label:'Notifications', ic:'◆'}, {id:'profile', label:'Profile', ic:'�'}]},
];

function MemberDashboard({ members, sessions, bookings, currentUserId, plans, onNav, toast }){
  const me = members.find(m => m.id === currentUserId) || members[0];
  const upcoming = bookings.length > 0 ? bookings : sessions.filter(s => s.member === (me?.name || 'Juan Dela Cruz')).slice(0, 3);
  const [showRenew, setShowRenew] = useState(false);
  const [renewPlan, setRenewPlan] = useState(plans.find(p => p.featured)?.name || plans[0]?.name);
  const [showBook, setShowBook] = useState(false);

  const renew = (e) => {
    e.preventDefault();
    const plan = plans.find(p => p.name === renewPlan);
    if (!plan) return;
    // We can't mutate transactions here — defer to MemberMembership for that.
    // Use a toast hint that points the member to the membership page.
    toast('Pick a plan on the membership page to confirm renewal');
  };

  // ---- Metrics tracker (weight / height / BMI) ----
  // Seeded from member record (if any) so dashboard always shows real numbers.
  const [metrics, setMetrics] = useState(() => ({
    weightKg: me?.weightKg ?? 72,
    heightCm: me?.heightCm ?? 172,
  }));
  const [editingMetrics, setEditingMetrics] = useState(false);
  const [draft, setDraft] = useState(metrics);

  const heightM = metrics.heightCm / 100;
  const bmi = heightM > 0 ? metrics.weightKg / (heightM * heightM) : 0;
  const bmiCategory =
    bmi < 18.5 ? {label:'Underweight', tone:'warn'} :
    bmi < 25   ? {label:'Healthy', tone:'ok'} :
    bmi < 30   ? {label:'Overweight', tone:'warn'} :
                 {label:'Obese', tone:'warn'};

  const saveMetrics = (e) => {
    e.preventDefault();
    const w = Number(draft.weightKg);
    const h = Number(draft.heightCm);
    if (!w || !h || w < 20 || h < 50) { toast('Please enter realistic values'); return; }
    setMetrics({weightKg:w, heightCm:h});
    setEditingMetrics(false);
    toast('Metrics updated — BMI ' + (w / Math.pow(h/100, 2)).toFixed(1));
  };

  return (
    <>
      <TabbedCard label="Welcome" title="">
        <h2 style={{fontSize:22, marginBottom:6}}>Welcome back, {(me?.name || 'Juan Dela Cruz').split(' ')[0]} 💪</h2>
        <p style={{color:'var(--steel)', margin:0}}>You're on the <b>{me?.plan || 'Premium'}</b> plan, renewing Sep 12, 2026.</p>
      </TabbedCard>
      <div style={{height:18}}></div>
      <div className="grid grid-2-1">
        <TabbedCard label="Sessions" title="Upcoming Sessions">
          {upcoming.length === 0 ? (
            <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>No upcoming sessions. Book one to get started.</div>
          ) : (
            <Table columns={['Date','Time','Trainer','Type','Status']} rows={upcoming} renderRow={s=>(
              <tr key={s.id}><td className="mono">{s.date}</td><td className="mono">{s.time}</td><td>{s.trainer}</td><td>{s.type}</td><td><Badge status={s.status}/></td></tr>
            )} />
          )}
        </TabbedCard>
        <TabbedCard label="Quick" title="Quick Actions">
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            <button className="btn btn-signal btn-block" onClick={()=>setShowBook(true)}>Book a Session</button>
            <button className="btn btn-outline btn-block" onClick={()=>onNav && onNav('membership')}>Renew Membership</button>
            <button className="btn btn-outline btn-block" onClick={()=>onNav && onNav('payments')}>View Receipts</button>
          </div>
        </TabbedCard>
      </div>
      <div style={{height:18}}></div>
      <div className="grid grid-2">
        <TabbedCard
          label="Progress"
          title="🏆 Your Progress"
          right={
            <button className="btn btn-outline btn-sm" onClick={()=>{setDraft(metrics); setEditingMetrics(true);}}>
              Update Metrics
            </button>
          }
        >
          {/* Metrics tracker — weight, height, BMI */}
          <div className="metrics-tracker">
            <div className="metric-tile">
              <div className="lbl">Weight</div>
              <div className="val">{metrics.weightKg.toFixed(1)}<span style={{fontSize:12, color:'var(--steel)', marginLeft:4}}>kg</span></div>
              <div className="sub">Last entry: today</div>
            </div>
            <div className="metric-tile">
              <div className="lbl">Height</div>
              <div className="val">{metrics.heightCm.toFixed(0)}<span style={{fontSize:12, color:'var(--steel)', marginLeft:4}}>cm</span></div>
              <div className="sub">{(metrics.heightCm/100).toFixed(2)} m</div>
            </div>
            <div className={"metric-tile "+bmiCategory.tone}>
              <div className="lbl">BMI</div>
              <div className="val">{bmi.toFixed(1)}</div>
              <div className="sub">{bmiCategory.label}</div>
            </div>
          </div>
          <hr style={{border:'none', borderTop:'1px solid var(--line)', margin:'14px 0'}}/>
          <div style={{marginBottom:12}}>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5}}><span>Monthly check-in goal</span><span className="mono">18/20</span></div>
            <div className="progress-bar"><div style={{width:'90%'}}></div></div>
          </div>
          <div>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5}}><span>PT sessions used</span><span className="mono">6/10</span></div>
            <div className="progress-bar"><div style={{width:'60%'}}></div></div>
          </div>
        </TabbedCard>
        <TabbedCard label="Activity" title="Activity This Month">
          <BarChart data={[{d:'Wk1',v:5},{d:'Wk2',v:7},{d:'Wk3',v:4},{d:'Wk4',v:6}]} valueKey="v" labelKey="d" />
        </TabbedCard>
      </div>

      {editingMetrics && (
        <Modal title="Update Metrics" onClose={()=>setEditingMetrics(false)}>
          <form onSubmit={saveMetrics}>
            <div className="grid grid-2">
              <Field label="Weight (kg)">
                <input className="form-control" type="number" step="0.1" required
                  value={draft.weightKg} onChange={e=>setDraft(d=>({...d, weightKg:e.target.value}))} />
              </Field>
              <Field label="Height (cm)">
                <input className="form-control" type="number" step="0.5" required
                  value={draft.heightCm} onChange={e=>setDraft(d=>({...d, heightCm:e.target.value}))} />
              </Field>
            </div>
            <p style={{fontSize:11.5, color:'var(--steel)', marginTop:6, marginBottom:14}}>
              BMI is calculated automatically: weight ÷ (height in m)².
            </p>
            <button type="submit" className="btn btn-signal btn-block">Save Metrics</button>
          </form>
        </Modal>
      )}

      {showBook && (
        <BookingCheckoutModal onClose={()=>setShowBook(false)} onComplete={()=>{setShowBook(false);}} />
      )}
    </>
  );
}

// ---------- End-to-end session booking checkout ----------
function BookingCheckoutModal({ initialTrainer, onClose, onComplete, onPersistBooking }){
  const [step, setStep] = useState(0);
  const [trainerName, setTrainerName] = useState(initialTrainer || 'James Reyes');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [method, setMethod] = useState('GCash');
  const [processing, setProcessing] = useState(false);
  const [confirmedId, setConfirmedId] = useState(null);
  const [amount] = useState(900);

  const goPayment = (e) => { e.preventDefault(); if (!date || !time) return; setStep(1); };

  const processPayment = (e) => {
    e.preventDefault();
    setProcessing(true);
    setTimeout(()=>{
      setProcessing(false);
      const id = 'S-' + (401 + Math.floor(Math.random()*900));
      setConfirmedId(id);
      setStep(2);
      onPersistBooking && onPersistBooking({id, trainer: trainerName, date, time, amount, method});
    }, 900);
  };

  return (
    <Modal title="Book Coaching Session" onClose={onClose} wide>
      <AnimatedStepTrack steps={['Select Slot','Payment','Confirmation']} current={step} />

      <AnimatePresence mode="wait" initial={false}>
        {step===0 && (
          <motion.form
            key="step-0"
            onSubmit={goPayment}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ duration: dur.base, ease: ease.out }}
          >
            <div className="grid grid-2">
              <Field label="Trainer">
                <Select value={trainerName} onChange={setTrainerName}>
                  {['James Reyes','Marco Cruz','Andrea Lim','Chris Santos'].map(t=><option key={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Session Rate">
                <input className="form-control mono" value={peso(amount)} readOnly />
              </Field>
              <Field label="Date"><TextInput type="date" required value={date} onChange={setDate} /></Field>
              <Field label="Time"><TextInput type="time" required value={time} onChange={setTime} /></Field>
            </div>
            <button className="btn btn-signal btn-block" type="submit">Continue to Payment</button>
          </motion.form>
        )}

        {step===1 && (
          <motion.form
            key="step-1"
            onSubmit={processPayment}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ duration: dur.base, ease: ease.out }}
          >
            <div className="checkout-summary">
              <div className="row"><span>Trainer</span><span>{trainerName}</span></div>
              <div className="row"><span>Date / Time</span><span className="mono">{date || '—'} {time || ''}</span></div>
              <div className="row" style={{fontWeight:700}}><span>Total Due</span><span className="mono">{peso(amount)}</span></div>
            </div>
            <Field label="Payment Method">
              <div className="pay-method-grid">
                {['GCash','Card','Cash'].map(m=>(
                  <div key={m} className={"pay-method"+(method===m?' active':'')} onClick={()=>setMethod(m)}>{m}</div>
                ))}
              </div>
            </Field>
            {method==='Card' && (
              <div className="grid grid-2">
                <Field label="Card Number"><TextInput placeholder="4242 4242 4242 4242" /></Field>
                <Field label="Expiry / CVC"><TextInput placeholder="MM/YY · CVC" /></Field>
              </div>
            )}
            <div style={{display:'flex', gap:8}}>
              <button type="button" className="btn btn-outline" onClick={()=>setStep(0)} disabled={processing}>Back</button>
              <button className="btn btn-signal btn-block" type="submit" disabled={processing}>
                {processing
                  ? <><span className="vm-spinner" style={{marginRight:8}}/>Processing Payment…</>
                  : `Pay ${peso(amount)}`}
              </button>
            </div>
          </motion.form>
        )}

        {step===2 && (
          <motion.div
            key="step-2"
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ duration: dur.base, ease: ease.out }}
          >
            <motion.div
              className="success-check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={spring.pop}
            >✓</motion.div>
            <h3 style={{textAlign:'center', fontSize:18, marginBottom:4}}>Booking Confirmed</h3>
            <p style={{textAlign:'center', color:'var(--steel)', fontSize:12.5, marginBottom:16}}>A confirmation has been sent to your email.</p>
            <motion.div
              className="receipt"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.base, delay: 0.12, ease: ease.out }}
            >
              <div style={{textAlign:'center', fontFamily:'var(--font-display)', fontSize:15}}>🏋 VINATHLETICS GYM</div>
              <div style={{textAlign:'center', fontSize:10.5, color:'var(--steel)'}}>Session Receipt · {confirmedId}</div>
              <hr/>
              <div className="row"><span>Trainer</span><span>{trainerName}</span></div>
              <div className="row"><span>Date / Time</span><span>{date} {time}</span></div>
              <div className="row"><span>Method</span><span>{method}</span></div>
              <hr/>
              <div className="row" style={{fontWeight:700}}><span>TOTAL PAID</span><span>{peso(amount)}</span></div>
            </motion.div>
            <button className="btn btn-signal btn-block" style={{marginTop:14}} onClick={onComplete}>Done</button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

function EditBookingModal({ booking, onClose, onSave, onCancelBooking }){
  const [tab, setTab] = useState('modify');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  return (
    <Modal title={`Edit Booking · ${booking.id}`} onClose={onClose}>
      <div className="modal-tabs">
        <button className={tab==='modify'?'active':''} onClick={()=>setTab('modify')}>Modify Booking</button>
        <button className={tab==='cancel'?'active':''} onClick={()=>setTab('cancel')}>Cancel Booking</button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {tab==='modify' ? (
          <motion.form
            key="modify"
            onSubmit={e=>{e.preventDefault(); onSave(booking.id, {date: date||booking.date, time: time||booking.time}); onClose();}}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            <p style={{fontSize:12.5, color:'var(--steel)', marginBottom:12}}>
              Currently scheduled with <b>{booking.trainer}</b> on <span className="mono">{booking.date}, {booking.time}</span>.
            </p>
            <div className="grid grid-2">
              <Field label="New Date"><TextInput type="date" onChange={setDate} /></Field>
              <Field label="New Time"><TextInput type="time" onChange={setTime} /></Field>
            </div>
            <button className="btn btn-signal btn-block" type="submit">Save Changes</button>
          </motion.form>
        ) : (
          <motion.div
            key="cancel"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            <p style={{fontSize:12.5, color:'var(--steel)', marginBottom:14}}>
              This will cancel your session with <b>{booking.trainer}</b> on <span className="mono">{booking.date}, {booking.time}</span>.
              {booking.paid ? ' Paid sessions are refunded to your original payment method.' : ''}
            </p>
            <button className="btn btn-danger btn-block" onClick={()=>{onCancelBooking(booking.id); onClose();}}>Confirm Cancellation</button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

function MemberMembership({ members, setMembers, plans, transactions, setTransactions, currentUserId, today, toast }){
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

function MemberCoaching({ bookings, setBookings, sessions, setSessions, transactions, setTransactions, trainers, setTrainers, currentUserId, members, today, toast }){
  const [showBooking, setShowBooking] = useState(false);
  const [bookingTrainer, setBookingTrainer] = useState(null);
  const [editing, setEditing] = useState(null);
  const [rateTarget, setRateTarget] = useState(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const me = members.find(m => m.id === currentUserId) || members[0];

  const openBookingFor = (trainerName) => { setBookingTrainer(trainerName); setShowBooking(true); };

  // Keystone: booking persists across navigation by mutating bookings + sessions + transactions.
  const handlePersistBooking = ({ id, trainer, date, time, amount, method }) => {
    const memberName = me?.name || 'Juan Dela Cruz';
    setBookings(prev => [...prev, {id, member: memberName, trainer, date, time, type:'Coaching', status:'Pending', paid:true, amount}]);
    setSessions(prev => [...prev, {id, member: memberName, trainer, date, time, type:'Coaching', status:'Pending', paid:true, amount}]);
    setTransactions(prev => [{
      id: 'TXN-' + (8821 + prev.length),
      member: memberName,
      type: 'PT Session (' + trainer + ')',
      amount, method,
      date: today,
      status: 'Paid',
    }, ...prev]);
    toast('Session booked and paid — ' + peso(amount));
  };

  const saveEdit = (id, changes) => {
    setBookings(prev => prev.map(b => b.id===id ? {...b, ...changes} : b));
    setSessions(prev => prev.map(s => s.id===id ? {...s, ...changes} : s));
    toast('Booking updated');
  };
  const cancelBooking = (id) => {
    setBookings(prev => prev.map(b => b.id===id ? {...b, status:'Cancelled'} : b));
    setSessions(prev => prev.map(s => s.id===id ? {...s, status:'Cancelled'} : s));
    toast('Booking cancelled');
  };

  const submitRating = () => {
    if (!rateTarget || stars === 0) { toast('Pick a star rating'); return; }
    const trainer = trainers.find(t => t.name === rateTarget.trainer);
    const review = { member: me?.name || 'You', stars, comment: comment.trim(), date: today };
    if (trainer) {
      const allReviews = [...(trainer.reviews || []), review];
      const avg = allReviews.reduce((a,r)=>a+r.stars,0) / allReviews.length;
      const rounded = Math.round(avg * 10) / 10;
      setTrainers(prev => prev.map(t => t.id === trainer.id ? { ...t, reviews: allReviews, rating: rounded } : t));
    }
    setBookings(prev => prev.map(b => b.id === rateTarget.id ? { ...b, rated: true, rating: stars } : b));
    toast('Thanks for rating ' + rateTarget.trainer + '!');
    setRateTarget(null);
    setStars(0);
    setComment('');
  };

  return (
    <>
      <TabbedCard label="Book" title="Available Schedules" right={<button className="btn btn-signal btn-sm" onClick={()=>openBookingFor(null)}>+ Book Session</button>}>
        <div className="grid grid-2">
          {trainers.map(t=>(
            <div className="card" key={t.id}>
              <div style={{display:'flex', gap:10}}>
                <span className="avatar-sm" style={{width:36,height:36}}>{INITIALS(t.name)}</span>
                <div><b>{t.name}</b><div style={{fontSize:12, color:'var(--steel)'}}>{t.specialty}</div></div>
              </div>
              <div className="mono" style={{fontSize:11.5, color:'var(--steel)', marginTop:10}}>Next opening: Tomorrow, 7:00 AM · {peso(t.sessionPrice)}/session</div>
              <button className="btn btn-outline btn-sm" style={{marginTop:10}} onClick={()=>openBookingFor(t.name)}>Book with {t.name.split(' ')[0]}</button>
            </div>
          ))}
        </div>
      </TabbedCard>
      <div style={{height:18}}></div>
      <TabbedCard label="Bookings" title="My Bookings">
        {bookings.length === 0 ? (
          <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>No bookings yet. Book your first session above.</div>
        ) : (
          <Table columns={['Date','Time','Trainer','Type','Status','']} rows={bookings} renderRow={s=>(
            <tr key={s.id}>
              <td className="mono">{s.date}</td><td className="mono">{s.time}</td><td>{s.trainer}</td><td>{s.type}</td><td><Badge status={s.status}/></td>
              <td style={{display:'flex', gap:6}}>
                {(s.status === 'Pending' || s.status === 'Confirmed') && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(s)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>cancelBooking(s.id)}>Cancel</button>
                  </>
                )}
                {s.status === 'Completed' && !s.rated && (
                  <button className="btn btn-signal btn-sm" onClick={()=>{ setRateTarget(s); setStars(0); setComment(''); }}>Rate Session</button>
                )}
                {s.status === 'Completed' && s.rated && (
                  <span className="badge ok" style={{fontSize:11}}>Rated ★{s.rating}</span>
                )}
              </td>
            </tr>
          )} />
        )}
      </TabbedCard>

      {showBooking && (
        <BookingCheckoutModal
          initialTrainer={bookingTrainer}
          onClose={()=>setShowBooking(false)}
          onComplete={()=>setShowBooking(false)}
          onPersistBooking={handlePersistBooking}
        />
      )}
      {editing && (
        <EditBookingModal
          booking={editing}
          onClose={()=>setEditing(null)}
          onSave={saveEdit}
          onCancelBooking={cancelBooking}
        />
      )}

      {rateTarget && (
        <Modal title={`Rate Session — ${rateTarget.trainer}`} onClose={()=>setRateTarget(null)}>
          <div style={{padding:'0 24px 24px'}}>
            <div style={{display:'flex', gap:6, justifyContent:'center', marginBottom:16}}>
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={()=>setStars(n)}
                  style={{fontSize:34, background:'none', border:'none', cursor:'pointer', color: n<=stars ? 'var(--signal)' : 'var(--steel)', lineHeight:1, padding:0}}
                >★</button>
              ))}
            </div>
            <Field label="Comment (optional)">
              <TextInput placeholder="How was the session?" value={comment} onChange={setComment} />
            </Field>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:8}}>
              <button className="btn btn-outline" type="button" onClick={()=>setRateTarget(null)}>Cancel</button>
              <button className="btn btn-signal" type="button" onClick={submitRating} disabled={stars===0}>Submit Rating</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function MemberPayments({ transactions, members, currentUserId, toast }){
  const [receipt, setReceipt] = useState(null);
  const me = members.find(m => m.id === currentUserId) || members[0];
  const mine = me ? transactions.filter(t => t.member === me.name) : transactions;

  return (
    <>
      <TabbedCard label="Finance" title="My Payment History">
        {mine.length === 0 ? (
          <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>No payments yet. Your membership renewals and bookings will appear here.</div>
        ) : (
          <Table columns={['ID','Type','Amount','Method','Date','Status','']} rows={mine} renderRow={t=>(
            <tr key={t.id}>
              <td className="mono">{t.id}</td><td>{t.type}</td><td className="mono">{peso(t.amount)}</td><td>{t.method}</td><td className="mono">{t.date}</td>
              <td><Badge status={t.status}/></td>
              <td><button className="btn btn-ghost btn-sm" onClick={()=>setReceipt(t)}>View Receipt</button></td>
            </tr>
          )} />
        )}
      </TabbedCard>

      {receipt && (
        <Modal title="Receipt" onClose={()=>setReceipt(null)}>
          <div className="receipt">
            <div style={{textAlign:'center', fontFamily:'var(--font-display)', fontSize:15}}>🏋 VINATHLETICS GYM</div>
            <div style={{textAlign:'center', fontSize:10.5, color:'var(--steel)'}}>Official Receipt · {receipt.id}</div>
            <hr/>
            <div className="row"><span>{receipt.type}</span><span>{peso(receipt.amount)}</span></div>
            <div className="row"><span>Method</span><span>{receipt.method}</span></div>
            <div className="row"><span>Date</span><span>{receipt.date}</span></div>
            <hr/>
            <div className="row" style={{fontWeight:700}}><span>TOTAL</span><span>{peso(receipt.amount)}</span></div>
          </div>
          <button className="btn btn-outline btn-sm btn-block" style={{marginTop:14}} onClick={()=>{window.print(); toast('Print dialog opened');}}>Download PDF</button>
        </Modal>
      )}
    </>
  );
}

export function NotificationsModal({ onClose, notifications, setNotifications, notifPrefs, setNotifPrefs, toast }){
  const [tab, setTab] = useState('inbox');
  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id===id ? {...n, unread:false} : n));
  };
  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({...n, unread:false})));
    toast('All notifications marked as read');
  };

  const toggle = (key) => {
    setNotifPrefs(p => ({...p, [key]: !p[key]}));
  };

  return (
    <Modal title="Notifications" onClose={onClose} wide>
      <div className="modal-tabs">
        <button className={tab==='inbox'?'active':''} onClick={()=>setTab('inbox')}>Inbox</button>
        <button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}>Settings</button>
      </div>

      {tab==='inbox' ? (
        <div>
          <div style={{display:'flex', justifyContent:'flex-end', marginBottom:8}}>
            <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all as read</button>
          </div>
          {notifications.length === 0 ? (
            <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>No notifications.</div>
          ) : notifications.map((n,i)=>(
            <motion.div
              key={n.id}
              style={{display:'flex', gap:10, padding:'12px 0', borderBottom:'1px solid var(--line)', cursor:'pointer'}}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
              onClick={() => n.unread && markRead(n.id)}
            >
              <span style={{width:8, height:8, borderRadius:'50%', background: n.unread?'var(--signal)':'transparent', marginTop:6, flexShrink:0}}></span>
              <div>
                <div style={{fontWeight: n.unread ? 700 : 600, fontSize:13}}>{n.title}</div>
                <div style={{fontSize:12, color:'var(--steel)'}}>{n.body}</div>
                <div className="mono" style={{fontSize:10.5, color:'var(--steel)', marginTop:2}}>{n.time}</div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div style={{fontSize:12.5}}>
          <div className="checkbox-row"><span>Email Notifications</span><Switch on={notifPrefs.email} onClick={()=>toggle('email')} /></div>
          <div className="checkbox-row"><span>SMS Notifications</span><Switch on={notifPrefs.sms} onClick={()=>toggle('sms')} /></div>
          <div className="checkbox-row"><span>Session Reminders</span><Switch on={notifPrefs.reminders} onClick={()=>toggle('reminders')} /></div>
          <div className="checkbox-row" style={{borderBottom:'none'}}><span>Promotions & Offers</span><Switch on={notifPrefs.promos} onClick={()=>toggle('promos')} /></div>
        </div>
      )}
    </Modal>
  );
}

function MemberProfile({ members, setMembers, currentUserId, toast }){
  const me = members.find(m => m.id === currentUserId) || members[0];
  const [info, setInfo] = useState({
    name: me?.name || '',
    email: me?.email || '',
    phone: me?.phone || '',
    emergency: '',
  });

  const submit = (e) => {
    e.preventDefault();
    setMembers(prev => prev.map(m => m.id === me.id ? {...m, ...info} : m));
    toast('Profile updated');
  };

  return (
    <div className="grid grid-1-2">
      <TabbedCard label="Profile" title={me?.name || 'Member'}>
        <div style={{textAlign:'center', marginBottom:14}}>
          <span className="avatar-sm" style={{width:64, height:64, fontSize:20}}>{INITIALS(me?.name || 'JD')}</span>
        </div>
        <div style={{fontSize:12.5}}>
          <div className="eyebrow">Member ID</div><p className="mono">{me?.id || 'M-1042'}</p>
          <div className="eyebrow">Plan</div><p>{me?.plan || 'Premium'}</p>
          <div className="eyebrow">Member Since</div><p className="mono">{me?.joined || 'Feb 12, 2025'}</p>
        </div>
      </TabbedCard>
      <TabbedCard label="Info" title="Account Information">
        <form onSubmit={submit}>
          <div className="grid grid-2">
            <Field label="Full Name"><TextInput required value={info.name} onChange={v=>setInfo(i=>({...i, name:v}))} /></Field>
            <Field label="Email"><TextInput type="email" required value={info.email} onChange={v=>setInfo(i=>({...i, email:v}))} /></Field>
            <Field label="Phone"><TextInput value={info.phone} onChange={v=>setInfo(i=>({...i, phone:v}))} /></Field>
            <Field label="Emergency Contact"><TextInput placeholder="+63 9XX XXX XXXX" value={info.emergency} onChange={v=>setInfo(i=>({...i, emergency:v}))} /></Field>
          </div>
          <button className="btn btn-signal btn-sm" type="submit">Save Changes</button>
        </form>
      </TabbedCard>
    </div>
  );
}

export const MEMBER_VIEWS = {
  dashboard:MemberDashboard, membership:MemberMembership, coaching:MemberCoaching,
  payments:MemberPayments, profile:MemberProfile,
};
