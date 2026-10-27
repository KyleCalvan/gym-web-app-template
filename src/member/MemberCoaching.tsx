// @ts-nocheck
import { useMemo, useState } from 'react';
import { Avatar, Badge, Table, TabbedCard, Modal, Field, TextInput } from '../shared';
import { peso } from '../data.ts';
import BookingCheckoutModal from './BookingCheckoutModal.tsx';
import EditBookingModal from './EditBookingModal.tsx';
import { getActivePromotionsForMember } from './promotionEligibility.ts';
import { getBookingDateError, getBookingDatesError, getBookingToday, isBookingSlotAvailable } from './bookingDates.ts';
import { getBookableDates, getCommonBookableTimes } from './bookingAvailability.ts';
import { formatTime12h } from '../trainer/availability.ts';

function MemberCoaching({ bookings, setBookings, sessions, setSessions, bookingSlots, trainerAvailability = [], setTransactions, trainers, setTrainers, promotions, setPromotions, promotionRedemptions, setPromotionRedemptions, currentUserId, members, today, toast, addAudit, preferredPaymentMethod, onCoachingCheckout, onCoachingCheckoutStatus, onCoachingCheckoutCancel }){
  const [showBooking, setShowBooking] = useState(false);
  const [bookingTrainer, setBookingTrainer] = useState(null);
  const [editing, setEditing] = useState(null);
  const [rateTarget, setRateTarget] = useState(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const me = members.find(m => m.id === currentUserId) || members[0];
  const myRedemptions = useMemo(
    () => (promotionRedemptions || []).filter((r) => r.memberId === me?.id),
    [promotionRedemptions, me?.id],
  );
  const activePromotions = useMemo(
    () => getActivePromotionsForMember(promotions || [], myRedemptions, me),
    [promotions, myRedemptions, me?.plan],
  );
  const occupiedSlots = bookingSlots || sessions;
  const activeTrainers = trainers.filter(t => !t.deletedAt && t.status === 'Active');

  const openBookingFor = (trainerName) => { setBookingTrainer(trainerName); setShowBooking(true); };

  const handlePersistBookings = ({ id, trainer, dates, time, amount, totalAmount, promoCode, savings }) => {
    const dateError = getBookingDatesError(dates, getBookingToday());
    if (dateError) return dateError;
    const selectedTrainer = activeTrainers.find(person => person.name === trainer);
    if (!selectedTrainer || !getCommonBookableTimes(trainerAvailability, occupiedSlots, selectedTrainer, dates).includes(time)) {
      return 'The selected trainer, dates, or time is no longer available. Choose another slot.';
    }
    const unavailableDate = dates.find((date) => !isBookingSlotAvailable(occupiedSlots, { trainer, date, time }));
    if (unavailableDate) return `That time is no longer available on ${unavailableDate}. Choose another slot.`;

    const memberName = me?.name || '';
    const newBookings = dates.map((date, index) => ({
      id: index === 0 ? id : `${id}-${index + 1}`,
      member: memberName,
      trainer,
      date,
      time,
      type:'Coaching',
      status:'Pending',
      paid:true,
      amount,
    }));
    setBookings(prev => [...prev, ...newBookings]);
    setSessions(prev => [...prev, ...newBookings]);
    const savingsNote = savings > 0 ? ` — saved ${peso(savings)} with ${promoCode}` : '';
    toast(`${dates.length} session${dates.length === 1 ? '' : 's'} booked with simulated payment — ${peso(totalAmount)}${savingsNote}`);
    addAudit?.('info', 'Sessions booked', `${trainer} — ${dates.length} dates — ${peso(totalAmount)}${promoCode ? ` — promo ${promoCode}` : ''}`);
    return null;
  };

  const saveEdit = (id, changes) => {
    if (changes.date) {
      const dateError = getBookingDateError(changes.date, getBookingToday());
      if (dateError) return dateError;
    }
    const currentBooking = bookings.find((booking) => booking.id === id);
    if (currentBooking && (changes.date || changes.time)) {
      const date = changes.date || currentBooking.date;
      const time = changes.time || currentBooking.time;
      if (!isBookingSlotAvailable(sessions, {
        trainer: currentBooking.trainer,
        date,
        time,
        excludeBookingId: id,
      })) return `That time is no longer available on ${date}. Choose another slot.`;
    }

    setBookings(prev => prev.map(b => b.id===id ? {...b, ...changes} : b));
    setSessions(prev => prev.map(s => s.id===id ? {...s, ...changes} : s));
    toast('Booking updated');
    addAudit?.('info', 'Booking updated', id);
    return null;
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
      <TabbedCard title="Available Schedules" right={<button className="btn btn-signal btn-sm" onClick={()=>openBookingFor(null)}>+ Book Session</button>}>
        <div className="grid grid-2">
          {activeTrainers.map(t=>(
            <div className="card" key={t.id}>
              <div style={{display:'flex', gap:10}}>
                <Avatar src={t.avatarUrl} name={t.name} size={36} />
                <div><b>{t.name}</b><div style={{fontSize:13.2, color:'var(--steel)'}}>{t.specialty}</div></div>
              </div>
              <div className="mono" style={{fontSize:12.7, color:'var(--steel)', marginTop:10}}>
                {(() => {
                  const nextDate = getBookableDates(trainerAvailability, occupiedSlots, t)[0];
                  const nextTime = nextDate && getCommonBookableTimes(trainerAvailability, occupiedSlots, t, [nextDate])[0];
                  return nextDate && nextTime ? `Next opening: ${nextDate}, ${formatTime12h(nextTime)} · ${peso(t.sessionPrice)}/session` : `No open dates · ${peso(t.sessionPrice)}/session`;
                })()}
              </div>
              <button className="btn btn-outline btn-sm" style={{marginTop:10}} onClick={()=>openBookingFor(t.name)} disabled={!getBookableDates(trainerAvailability, occupiedSlots, t).length}>Book with {t.name.split(' ')[0]}</button>
            </div>
          ))}
          {!activeTrainers.length && <p className="booking-date-hint">No trainers are available yet.</p>}
        </div>
      </TabbedCard>
      <div style={{height:18}}></div>
      <TabbedCard title="My Bookings">
        {bookings.length === 0 ? (
          <div style={{fontSize:14.3, color:'var(--steel)', padding:'10px 0'}}>No bookings yet. Book your first session above.</div>
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
                  <span className="badge ok" style={{fontSize:12.1}}>Rated ★{s.rating}</span>
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
          trainerAvailability={trainerAvailability}
          bookingSlots={occupiedSlots}
          activePromotions={activePromotions}
          promotions={promotions}
          setPromotions={setPromotions}
          promotionRedemptions={promotionRedemptions}
          setPromotionRedemptions={setPromotionRedemptions}
          member={me}
          setTransactions={setTransactions}
          preferredPaymentMethod={preferredPaymentMethod}
          onCoachingCheckout={onCoachingCheckout}
          onCoachingCheckoutStatus={onCoachingCheckoutStatus}
          onCoachingCheckoutCancel={onCoachingCheckoutCancel}
          today={today}
          onClose={()=>setShowBooking(false)}
          onComplete={()=>setShowBooking(false)}
          onPersistBookings={handlePersistBookings}
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
                  style={{fontSize:37.4, background:'none', border:'none', cursor:'pointer', color: n<=stars ? 'var(--signal)' : 'var(--steel)', lineHeight:1, padding:0}}
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
