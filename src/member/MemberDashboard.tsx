// @ts-nocheck
import { useState } from 'react';
import { Badge, BarChart, Table, TabbedCard, Modal, Field } from '../shared';
import BookingCheckoutModal from './BookingCheckoutModal.tsx';

function MemberDashboard({ members, sessions, bookings, currentUserId, plans, onNav, toast, checkInHistory }){
  const me = members.find(m => m.id === currentUserId) || members[0];
  const upcoming = bookings.length > 0 ? bookings : sessions.filter(s => s.member === me?.name).slice(0, 3);
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

  // Real data: this month's check-ins + session count.
  const myId = me?.id || '';
  const monthCheckIns = (checkInHistory || []).filter(r => {
    if (r.memberId !== myId) return false;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return r.date.startsWith(ym);
  }).length;
  const monthCheckPct = Math.min(100, Math.round((monthCheckIns / 20) * 100));
  const mySessionsCount = sessions.filter(s => s.member === me?.name).length;
  const sessionGoal = 10;
  const sessionPct = Math.min(100, Math.round((mySessionsCount / sessionGoal) * 100));

  // Weekly chart derived from real check-ins.
  const weeklyData = (() => {
    const now = new Date();
    const buckets = [0, 0, 0, 0];
    (checkInHistory || []).forEach(r => {
      if (r.memberId !== myId) return;
      const d = new Date(r.date);
      const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays > 28) return;
      const idx = Math.min(3, Math.floor(diffDays / 7));
      buckets[idx]++;
    });
    return [
      { d: 'Wk1', v: buckets[0] },
      { d: 'Wk2', v: buckets[1] },
      { d: 'Wk3', v: buckets[2] },
      { d: 'Wk4', v: buckets[3] },
    ];
  })();

  return (
    <>
      <TabbedCard label="Welcome" title="">
        <h2 style={{fontSize:22, marginBottom:6}}>Welcome back{me?.name ? `, ${me.name.split(' ')[0]}` : ''} 💪</h2>
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
            <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5}}><span>Monthly check-in goal</span><span className="mono">{monthCheckIns}/20 ({monthCheckPct}%)</span></div>
            <div className="progress-bar"><div style={{width:`${monthCheckPct}%`}}></div></div>
          </div>
          <div>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5}}><span>PT sessions used</span><span className="mono">{mySessionsCount}/{sessionGoal} ({sessionPct}%)</span></div>
            <div className="progress-bar"><div style={{width:`${sessionPct}%`}}></div></div>
          </div>
        </TabbedCard>
        <TabbedCard label="Activity" title="Activity This Month">
          <BarChart data={weeklyData} valueKey="v" labelKey="d" />
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