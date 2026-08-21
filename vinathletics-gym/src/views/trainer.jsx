import { useState } from 'react';
import { TabbedCard, StatTile, Badge, Table, Modal, Field, TextInput, Select } from '../components.jsx';

export const TRAINER_NAV = [
  {section:'Main', items:[
    {id:'dashboard', label:'Dashboard', ic:'▤'},
    {id:'sessions', label:'Assigned Sessions', ic:'●'},
    {id:'schedule', label:'Schedule & Availability', ic:'▤'},
    {id:'profile', label:'My Profile', ic:'◆'},
  ]},
];

function TrainerDashboard({ sessions, currentUserId, trainers }){
  const today = new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
  const trainerName = trainers.find(t => t.id === currentUserId)?.name || trainers[0]?.name;
  const mine = sessions.filter(s => s.trainer === trainerName);
  const todays = mine.filter(s => s.date === today);
  const completedThisWeek = mine.filter(s => s.status === 'Completed').length;
  const upcomingCount = mine.filter(s => s.status !== 'Completed' && s.status !== 'Cancelled').length;
  const trainer = trainers.find(t => t.id === currentUserId) || trainers[0];

  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Sessions Today" value={todays.length} tone="court"/>
        <StatTile label="This Week" value={completedThisWeek}/>
        <StatTile label="Avg. Rating" value={trainer ? '★ ' + trainer.rating : '—'} tone="amber"/>
        <StatTile label="Upcoming" value={upcomingCount} tone="steel"/>
      </div>
      <TabbedCard label="Today" title={"Your Sessions — " + today}>
        {todays.length === 0 ? (
          <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>No sessions scheduled today.</div>
        ) : (
          <Table columns={['Time','Member','Type','Status']} rows={todays} renderRow={s=>(
            <tr key={s.id}><td className="mono">{s.time}</td><td>{s.member}</td><td>{s.type}</td><td><Badge status={s.status}/></td></tr>
          )} />
        )}
      </TabbedCard>
    </>
  );
}

function TrainerSessions({ sessions, setSessions, currentUserId, trainers, toast }){
  const [showRequest, setShowRequest] = useState(false);
  const trainerName = trainers.find(t => t.id === currentUserId)?.name || trainers[0]?.name;
  const mine = sessions.filter(s => s.trainer === trainerName);

  const [req, setReq] = useState({sessionId:'', dateTime:'', reason:''});
  const submitRequest = (e) => {
    e.preventDefault();
    if (!req.sessionId || !req.dateTime) { toast('Pick a session and a new date/time'); return; }
    const session = sessions.find(s => s.id === req.sessionId);
    if (!session) return;
    const dt = new Date(req.dateTime);
    if (isNaN(dt)) { toast('Invalid date'); return; }
    const date = dt.toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
    const time = dt.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
    // Append a Pending session reflecting the requested reschedule.
    setSessions(prev => [...prev, {
      id: 'S-' + (401 + prev.length),
      member: session.member, trainer: session.trainer, date, time, type: session.type,
      status: 'Pending', paid: false, amount: 0, reason: req.reason || 'Schedule change requested',
    }]);
    toast('Request sent to admin for ' + session.id);
    setShowRequest(false);
    setReq({sessionId:'', dateTime:'', reason:''});
  };

  const complete = (id) => {
    setSessions(prev => prev.map(s => s.id===id ? {...s, status:'Completed'} : s));
    toast('Session ' + id + ' marked completed');
  };
  const cancel = (id) => {
    setSessions(prev => prev.map(s => s.id===id ? {...s, status:'Cancelled'} : s));
    toast('Session ' + id + ' cancelled');
  };
  const accept = (id) => {
    setSessions(prev => prev.map(s => s.id===id ? {...s, status:'Confirmed'} : s));
    toast('Session ' + id + ' accepted');
  };
  const decline = (id) => {
    setSessions(prev => prev.map(s => s.id===id ? {...s, status:'Declined'} : s));
    toast('Session ' + id + ' declined');
  };

  return (
    <>
      <TabbedCard label="Sessions" title="Assigned Sessions" right={<button className="btn btn-outline btn-sm" onClick={()=>setShowRequest(true)}>Request Schedule Change</button>}>
        {mine.length === 0 ? (
          <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>No sessions assigned yet.</div>
        ) : (
          <Table columns={['ID','Member','Date','Time','Type','Status','']} rows={mine} renderRow={s=>(
            <tr key={s.id}>
              <td className="mono">{s.id}</td><td>{s.member}</td><td className="mono">{s.date}</td><td className="mono">{s.time}</td><td>{s.type}</td>
              <td><Badge status={s.status}/></td>
              <td style={{display:'flex', gap:6}}>
                {s.status === 'Pending' && (
                  <>
                    <button className="btn btn-signal btn-sm" onClick={()=>accept(s.id)}>Accept</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>decline(s.id)}>Decline</button>
                  </>
                )}
                {s.status === 'Confirmed' && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={()=>complete(s.id)}>Complete</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>cancel(s.id)}>Cancel</button>
                  </>
                )}
                {s.status === 'Completed' && <span style={{fontSize:11, color:'var(--steel)'}}>Completed</span>}
                {s.status === 'Cancelled' && <span style={{fontSize:11, color:'var(--steel)'}}>Cancelled</span>}
                {s.status === 'Declined'  && <span style={{fontSize:11, color:'var(--steel)'}}>Declined</span>}
              </td>
            </tr>
          )} />
        )}
      </TabbedCard>

      {showRequest && (
        <Modal title="Request Schedule Change" onClose={()=>setShowRequest(false)}>
          <form onSubmit={submitRequest}>
            <Field label="Session">
              <Select value={req.sessionId} onChange={v=>setReq(r=>({...r, sessionId:v}))}>
                <option value="">Pick a session…</option>
                {mine.map(s=><option key={s.id} value={s.id}>{s.id} — {s.member} ({s.date})</option>)}
              </Select>
            </Field>
            <Field label="Requested New Date & Time"><TextInput type="datetime-local" required value={req.dateTime} onChange={v=>setReq(r=>({...r, dateTime:v}))} /></Field>
            <Field label="Reason"><textarea className="form-control" rows="3" placeholder="Why are you requesting this change?" value={req.reason} onChange={e=>setReq(r=>({...r, reason:e.target.value}))} /></Field>
            <button className="btn btn-signal btn-block" type="submit">Send Request</button>
          </form>
        </Modal>
      )}
    </>
  );
}

function TrainerSchedule({ sessions, currentUserId, trainers, toast }){
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const trainerName = trainers.find(t => t.id === currentUserId)?.name || trainers[0]?.name;
  const [avail, setAvail] = useState({day:'Mon', from:'06:00', to:'09:00'});

  const submitted = (e) => {
    e.preventDefault();
    toast(`Availability saved — ${avail.day} ${avail.from}–${avail.to}`);
  };

  // Derive booked sessions count per weekday for the current trainer.
  const bookedByDay = {};
  sessions.filter(s => s.trainer === trainerName).forEach(s => {
    const d = new Date(s.date);
    if (isNaN(d)) return;
    const wkday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    bookedByDay[wkday] = (bookedByDay[wkday] || 0) + 1;
  });

  return (
    <>
      <TabbedCard label="Schedule" title="Weekly Schedule">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Day</th><th>Available Hours</th><th>Booked Sessions</th></tr></thead>
            <tbody>
              {days.map((d,i)=>(
                <tr key={d}>
                  <td>{d}</td>
                  <td className="mono">{i===6 ? 'Unavailable' : '6:00 AM – 9:00 AM, 4:00 PM – 8:00 PM'}</td>
                  <td className="mono">{i===6 ? '—' : (bookedByDay[d] || 0) + ' booked'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TabbedCard>
      <div style={{height:18}}></div>
      <TabbedCard label="Availability" title="Set / Update Availability">
        <form onSubmit={submitted}>
          <div className="grid grid-3">
            <Field label="Day">
              <Select value={avail.day} onChange={v=>setAvail(a=>({...a, day:v}))}>
                {days.map(d=><option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="From"><TextInput type="time" required value={avail.from} onChange={v=>setAvail(a=>({...a, from:v}))} /></Field>
            <Field label="To"><TextInput type="time" required value={avail.to} onChange={v=>setAvail(a=>({...a, to:v}))} /></Field>
          </div>
          <button className="btn btn-signal btn-sm" type="submit">Save Availability</button>
        </form>
      </TabbedCard>
    </>
  );
}

function TrainerProfile({ currentUserId, trainers, setTrainers, toast }){
  const trainer = trainers.find(t => t.id === currentUserId) || trainers[0];
  const [info, setInfo] = useState({
    name: trainer?.name || '',
    specialty: trainer?.specialty || '',
    email: trainer?.email || (trainer?.name ? trainer.name.toLowerCase().replace(/\s/g,'.') + '@vinathletics.gym' : ''),
    phone: trainer?.phone || '',
    bio: trainer?.bio || '',
  });
  const [pw, setPw] = useState({current:'', next:'', confirm:''});

  const submitInfo = (e) => {
    e.preventDefault();
    setTrainers(prev => prev.map(t => t.id===trainer.id ? {...t, ...info} : t));
    toast('Profile updated');
  };

  const submitPassword = (e) => {
    e.preventDefault();
    if (pw.next.length < 8) { toast('Password must be at least 8 characters'); return; }
    if (pw.next !== pw.confirm) { toast('Passwords do not match'); return; }
    toast('Password updated');
    setPw({current:'', next:'', confirm:''});
  };

  return (
    <div className="grid grid-1-2">
      <TabbedCard label="Profile" title={trainer?.name || 'Trainer'}>
        <div style={{textAlign:'center', marginBottom:14}}>
          <span className="avatar-sm" style={{width:64, height:64, fontSize:20}}>{(trainer?.name || '').split(' ').map(p=>p[0]).slice(0,2).join('')}</span>
        </div>
        <div style={{fontSize:12.5}}>
          <div className="eyebrow">Specialty</div><p>{info.specialty}</p>
          <div className="eyebrow">Certifications</div><p>{trainer?.certs || '—'}</p>
          <div className="eyebrow">Rating</div><p className="mono">★ {trainer?.rating || '—'}</p>
        </div>
      </TabbedCard>
      <div>
        <TabbedCard label="Info" title="Professional Information">
          <form onSubmit={submitInfo}>
            <div className="grid grid-2">
              <Field label="Full Name"><TextInput required value={info.name} onChange={v=>setInfo(i=>({...i, name:v}))} /></Field>
              <Field label="Specialty"><TextInput value={info.specialty} onChange={v=>setInfo(i=>({...i, specialty:v}))} /></Field>
              <Field label="Email"><TextInput type="email" required value={info.email} onChange={v=>setInfo(i=>({...i, email:v}))} /></Field>
              <Field label="Phone"><TextInput value={info.phone} onChange={v=>setInfo(i=>({...i, phone:v}))} /></Field>
            </div>
            <Field label="Bio"><textarea className="form-control" rows="3" value={info.bio} onChange={e=>setInfo(i=>({...i, bio:e.target.value}))} /></Field>
            <button className="btn btn-signal btn-sm" type="submit">Save Changes</button>
          </form>
        </TabbedCard>
        <div style={{height:18}}></div>
        <TabbedCard label="Security" title="Change Password">
          <form onSubmit={submitPassword}>
            <div className="grid grid-3">
              <Field label="Current Password"><TextInput type="password" required value={pw.current} onChange={v=>setPw(p=>({...p, current:v}))} /></Field>
              <Field label="New Password"><TextInput type="password" required value={pw.next} onChange={v=>setPw(p=>({...p, next:v}))} /></Field>
              <Field label="Confirm New Password"><TextInput type="password" required value={pw.confirm} onChange={v=>setPw(p=>({...p, confirm:v}))} /></Field>
            </div>
            <button className="btn btn-outline btn-sm" type="submit">Update Password</button>
          </form>
        </TabbedCard>
      </div>
    </div>
  );
}

export const TRAINER_VIEWS = {
  dashboard:TrainerDashboard, sessions:TrainerSessions, schedule:TrainerSchedule, profile:TrainerProfile,
};
