// @ts-nocheck
import { useState } from 'react';
import { Badge, BarChart, Table, TabbedCard, Modal, Field } from '../shared';
import BookingCheckoutModal from './BookingCheckoutModal.tsx';

function MemberDashboard({ members, sessions, bookings, currentUserId, plans, onNav, toast }){
  const me = members.find(m => m.id === currentUserId) || members[0];
  const upcoming = bookings.length > 0 ? bookings : sessions.filter(s => s.member === (me?.name || 'Juan Dela Cruz')).slice(0, 3);
  const [showBook, setShowBook] = useState(false);

  // ---- Metrics tracker (weight / height / BMI) ----
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
          right={<button className="btn btn-outline btn-sm" onClick={()=>{setDraft(metrics); setEditingMetrics(true);}}>Update Metrics</button>}
        >
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

export default MemberDashboard;