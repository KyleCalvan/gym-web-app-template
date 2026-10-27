// @ts-nocheck
import { useMemo, useState } from 'react';
import { Badge, Table, TabbedCard } from '../shared';
import BookingCheckoutModal from './BookingCheckoutModal.tsx';
import { formatPromotionDate, formatPromotionDiscount, getActivePromotionsForMember, getEligiblePromotions } from './promotionEligibility.ts';
import { getBookingDatesError, getBookingToday, isBookingSlotAvailable } from './bookingDates.ts';
import { getCommonBookableTimes } from './bookingAvailability.ts';
import { peso } from '../data.ts';

function MemberDashboard({ members, sessions, setSessions, bookings, setBookings, setTransactions, transactions, trainers, trainerAvailability = [], bookingSlots, currentUserId, plans, promotions, setPromotions, promotionRedemptions, setPromotionRedemptions, onNav, toast, today, addAudit, preferredPaymentMethod, onBook, paymentKnown = true, promotionsAvailable = true, promotionsLoading = false, promotionsError = '' }){
  const me = members.find(m => m.id === currentUserId) || members[0];
  const todayISO = getBookingToday();
  const myRedemptions = useMemo(
    () => (promotionRedemptions || []).filter((r) => r.memberId === me?.id),
    [promotionRedemptions, me?.id],
  );
  const activePromotions = useMemo(
    () => getActivePromotionsForMember(promotions || [], myRedemptions, me, today || new Date()),
    [promotions, myRedemptions, me?.plan, today],
  );
  const upcomingSource = bookings.length > 0 ? bookings : sessions.filter(s => s.member === me?.name);
  const upcoming = upcomingSource
    .filter(s => s.status !== 'Cancelled' && s.date >= todayISO)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 4);
  const latestPayment = (transactions || [])
    .filter(t => t.member === me?.name)
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const expiry = me?.membershipValidUntil ? new Date(`${me.membershipValidUntil.slice(0, 10)}T00:00:00`) : null;
  const remainingDays = expiry && !Number.isNaN(expiry.getTime())
    ? Math.ceil((expiry.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000)
    : null;
  const validityText = remainingDays === null ? 'Expiry date not recorded'
    : remainingDays < 0 ? `Expired ${Math.abs(remainingDays)} day${Math.abs(remainingDays) === 1 ? '' : 's'} ago`
    : remainingDays === 0 ? 'Expires today'
    : `${remainingDays} day${remainingDays === 1 ? '' : 's'} remaining`;
  const eligiblePromotions = getEligiblePromotions(promotions || [], me, today || new Date()).slice(0, 2);
  const [showBook, setShowBook] = useState(false);

  const persistBookings = ({ id, trainer, dates, time, amount, totalAmount }) => {
    const dateError = getBookingDatesError(dates, getBookingToday());
    if (dateError) return dateError;
    const selectedTrainer = trainers.find(person => person.name === trainer && !person.deletedAt && person.status === 'Active');
    const occupiedSlots = bookingSlots || sessions;
    if (!selectedTrainer || !getCommonBookableTimes(trainerAvailability, occupiedSlots, selectedTrainer, dates).includes(time)) {
      return 'The selected trainer, dates, or time is no longer available. Choose another slot.';
    }
    const unavailableDate = dates.find(date => !isBookingSlotAvailable(occupiedSlots, { trainer, date, time }));
    if (unavailableDate) return `That time is no longer available on ${unavailableDate}. Choose another slot.`;
    const newBookings = dates.map((date, index) => ({
      id: index === 0 ? id : `${id}-${index + 1}`,
      member: me?.name || '',
      trainer,
      date,
      time,
      type: 'Coaching',
      status: 'Pending',
      paid: true,
      amount,
    }));
    setBookings(prev => [...prev, ...newBookings]);
    setSessions(prev => [...prev, ...newBookings]);
    toast(`${dates.length} session${dates.length === 1 ? '' : 's'} booked with simulated payment — ${peso(totalAmount)}`);
    addAudit?.('info', 'Sessions booked', `${trainer} — ${dates.length} dates`);
    return null;
  };










  return (
    <>
      <section className="member-dashboard-summary card" aria-labelledby="member-dashboard-heading">
        <div className="member-dashboard-intro">
          <h2 id="member-dashboard-heading">Welcome back{me?.name ? `, ${me.name.split(' ')[0]}` : ''}</h2>
          <p>Your membership, sessions, and payments at a glance.</p>
        </div>
        <div className="member-dashboard-membership">
          <div className="member-dashboard-plan">
            <span className="member-summary-label">Current plan</span>
            <strong>{me?.plan || 'No plan selected'}</strong>
            {me?.status && <Badge status={me.status} />}
          </div>
          <div className="member-summary-detail">
            <span className="member-summary-label">Validity</span>
            <strong>{validityText}</strong>
            {expiry && !Number.isNaN(expiry.getTime()) && <span>Through {formatPromotionDate(me.membershipValidUntil)}</span>}
          </div>
          <div className="member-summary-detail">
            <span className="member-summary-label">Latest payment</span>
            {latestPayment ? <><strong><Badge status={latestPayment.status} /></strong><span>{latestPayment.type} · {peso(latestPayment.amount)} · {latestPayment.date}</span></> : <strong>No payment recorded</strong>}
          </div>
        </div>
      </section>

      <div className="grid grid-2-1 member-dashboard-main-grid">
        <TabbedCard title="Upcoming Sessions">
          {upcoming.length === 0 ? (
            <div className="member-dashboard-empty">No upcoming sessions. Book a coaching session to get started.</div>
          ) : (
            <Table columns={paymentKnown ? ['Date','Time','Trainer','Session','Booking','Payment'] : ['Date','Time','Trainer','Session','Booking']} rows={upcoming} renderRow={s=>(
              <tr key={s.id}>
                <td className="mono">{formatPromotionDate(s.date)}</td>
                <td className="mono">{s.time}</td>
                <td>{s.trainer}</td>
                <td>{s.type}</td>
                <td><Badge status={s.status}/></td>
                {paymentKnown && <td><Badge status={s.paymentStatus ?? 'Not recorded'}/></td>}
              </tr>
            )} />
          )}
        </TabbedCard>
        <TabbedCard title="Quick Actions">
          <div className="member-dashboard-actions">
            <button className="btn btn-signal btn-block" onClick={()=>onBook ? onBook() : setShowBook(true)}>Book a Session</button>
            <button className="btn btn-outline btn-block" onClick={()=>onNav && onNav('membership')}>Manage Membership</button>
            <button className="btn btn-outline btn-block" onClick={()=>onNav && onNav('payments')}>View Payments</button>
            <button className="btn btn-outline btn-block" onClick={()=>onNav && onNav('promotions')}>Browse Promotions</button>
          </div>
        </TabbedCard>
      </div>

      <TabbedCard
        title="Current Promotions"
        right={<button className="btn btn-outline btn-sm" onClick={()=>onNav && onNav('promotions')}>View all</button>}
      >
        {promotionsLoading ? (
          <div className="member-dashboard-empty" role="status">Loading promotions…</div>
        ) : promotionsError ? (
          <div className="member-dashboard-empty" role="alert">Promotions could not be loaded. Open Promotions to retry.</div>
        ) : !promotionsAvailable || eligiblePromotions.length === 0 ? (
          <div className="member-dashboard-empty">{promotionsAvailable ? 'No active promotions are available for your current plan.' : 'Promotions are not available online yet.'}</div>
        ) : (
          <div className="member-promo-preview-grid">
            {eligiblePromotions.map(p => (
              <article className="member-promo-preview" key={p.id}>
                <div className="member-promo-preview-head">
                  <span className="badge ok">{formatPromotionDiscount(p)}</span>
                  <span className="member-promo-preview-code">{p.code}</span>
                </div>
                <h3>{p.title}</h3>
                <p>{p.description || `Available for ${p.plan === 'Any' || p.plan === 'Any Plan' ? 'all plans' : p.plan}.`}</p>
                <span className="member-promo-preview-valid">Valid through {formatPromotionDate(p.validUntil)}</span>
              </article>
            ))}
          </div>
        )}
      </TabbedCard>

      {showBook && (
        <BookingCheckoutModal
          trainers={trainers}
          trainerAvailability={trainerAvailability}
          bookingSlots={bookingSlots || sessions}
          activePromotions={activePromotions}
          promotions={promotions}
          setPromotions={setPromotions}
          promotionRedemptions={promotionRedemptions}
          setPromotionRedemptions={setPromotionRedemptions}
          member={me}
          setTransactions={setTransactions}
          preferredPaymentMethod={preferredPaymentMethod}
          today={today}
          onClose={()=>setShowBook(false)}
          onComplete={()=>{setShowBook(false);}}
          onPersistBookings={persistBookings}
        />
      )}
    </>
  );
}

export default MemberDashboard;
