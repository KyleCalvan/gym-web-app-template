// @ts-nocheck
import { useState } from 'react';
import { Avatar, Badge, Table, TabbedCard, Modal, Field, TextInput } from '../shared';
import { peso } from '../data.ts';
import BookingCheckoutModal from './BookingCheckoutModal.tsx';
import EditBookingModal from './EditBookingModal.tsx';

function MemberCoaching({ bookings, setBookings, sessions, setSessions, setTransactions, trainers, setTrainers, currentUserId, members, today, toast, addAudit }){
  const [showBooking, setShowBooking] = useState(false);
  const [bookingTrainer, setBookingTrainer] = useState(null);
  const [editing, setEditing] = useState(null);
  const [rateTarget, setRateTarget] = useState(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const me = members.find(m => m.id === currentUserId) || members[0];

  const openBookingFor = (trainerName) => { setBookingTrainer(trainerName); setShowBooking(true); };

  const handlePersistBooking = ({ id, trainer, date, time, amount, method }) => {
    const memberName = me?.name || '';
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
    addAudit?.('info', 'Session booked', trainer + ' — ' + peso(amount));
  };

  const saveEdit = (id, changes) => {
    setBookings(prev => prev.map(b => b.id===id ? {...b, ...changes} : b));
    setSessions(prev => prev.map(s => s.id===id ? {...s, ...changes} : s));
    toast('Booking updated');
    addAudit?.('info', 'Booking updated', id);
  };
  const cancelBooking = (id) => {
    setBookings(prev => prev.map(b => b.id===id ? {...b, status:'Cancelled'} : b));
    setSessions(prev => prev.map(s => s.id===id ? {...s, status:'Cancelled'} : s));
    toast('Booking cancelled');
    addAudit?.('warn', 'Booking cancelled', id);
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
                <Avatar src={t.avatarUrl} name={t.name} size={36} />
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
          trainers={trainers}
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
        <Modal title={`Rate Session — ${rateTarget.trainer}`} showCloseButton={false} onClose={()=>setRateTarget(null)}>
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

export default MemberCoaching;