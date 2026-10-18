// @ts-nocheck
import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dropdown, Modal, AnimatedStepTrack, Field, TextInput, Select, ReceiptDocument, PaymentSimulationModal } from '../shared';
import { peso } from '../data.ts';
import { dur, ease, spring } from '../motion.tsx';
import { Tag } from 'lucide-react';
import {
  computeDiscountedPrice,
  findRedeemablePromotion,
  formatPromotionDiscount,
  promotionMeetsMinSpend,
  promotionTargetsAllPlans,
} from './promotionEligibility.ts';
import { createSimulatedTransaction, getConfiguredPaymentFee, updateSimulatedTransaction } from '../payments.ts';
import { getBookingDateError, getBookingDatesError, getBookingToday } from './bookingDates.ts';

const FALLBACK_SESSION_RATE = 900;
const PAYMENT_METHODS = [
  { value: 'GCash', label: 'GCash' },
  { value: 'Cash', label: 'Cash' },
];

function BookingRedeemCode({ promotions, redemptions, setPromotions, setPromotionRedemptions, member, onRedeemed }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState(null);
  const handleRedeem = () => {
    const { promotion, error } = findRedeemablePromotion(promotions || [], redemptions || [], member, code);
    if (!promotion) { setStatus({ type: 'error', message: error || 'Invalid promotion code' }); return; }
    setPromotions((prev) => prev.map((p) => p.id === promotion.id ? { ...p, redemptions: Number(p.redemptions || 0) + 1 } : p));
    setPromotionRedemptions((prev) => [
      ...prev,
      { id: 'PR-' + Date.now(), memberId: member.id, promotionId: promotion.id, code: promotion.code, redeemedAt: new Date().toISOString() },
    ]);
    setStatus({ type: 'success', message: `${formatPromotionDiscount(promotion)} applied to this booking.` });
    setCode('');
    onRedeemed?.(promotion);
  };
  return (
    <div className="member-promo-redeem-box" aria-label="Apply promotion code to this booking">
      <div className="member-promo-redeem-intro">
        <Tag size={16} aria-hidden="true" />
        <div>
          <strong>Have a promo code?</strong>
          <span>Enter it to apply a discount to this booking.</span>
        </div>
      </div>
      <div className="member-promo-redeem-controls">
        <input
          type="text"
          className="form-control mono"
          placeholder="Enter code e.g. WELCOME20"
          value={code}
          onChange={(e) => { setCode(e.target.value); setStatus(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRedeem(); } }}
          aria-label="Promotion code"
        />
        <button type="button" className="btn btn-signal" onClick={handleRedeem} disabled={!code.trim()}>
          Apply
        </button>
      </div>
      {status && (
        <div
          className="member-promo-redeem-status"
          role="status"
          aria-live="polite"
          style={{
            backgroundColor: status.type === 'success' ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
            color: status.type === 'success' ? 'rgb(40, 167, 69)' : 'rgb(220, 53, 69)',
          }}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}

function BookingCheckoutModal({
  initialTrainer, trainers = [], activePromotions = [], today,
  promotions, setPromotions, promotionRedemptions, setPromotionRedemptions, member,
  onClose, onComplete, onPersistBookings, setTransactions, preferredPaymentMethod = 'GCash',
}){
  const [step, setStep] = useState(0);
  const [trainerName, setTrainerName] = useState(initialTrainer || trainers[0]?.name || '');
  const [date, setDate] = useState('');
  const [dates, setDates] = useState([]);
  const [time, setTime] = useState('');
  const [method, setMethod] = useState(preferredPaymentMethod);
  const [processing, setProcessing] = useState(false);
  const processingLock = useRef(false);
  const [confirmedId, setConfirmedId] = useState(null);
  const [receiptNumber, setReceiptNumber] = useState(null);
  const [bookingError, setBookingError] = useState('');
  const [payment, setPayment] = useState(null);
  const minDate = getBookingToday();

  const availableTrainers = (trainers || []).filter(t => !t.deletedAt && t.status !== 'Inactive');
  const selectedTrainer = availableTrainers.find(t => t.name === trainerName);
  const baseRate = selectedTrainer?.sessionPrice || FALLBACK_SESSION_RATE;
  const sessionCount = Math.max(dates.length, 0);
  const undiscountedTotal = baseRate * sessionCount;

  // Best active promo that applies to trainer sessions (plan = Any) and meets minSpend.
  const sessionDiscount = useMemo(() => {
    if (!sessionCount) return null;
    let best = null;
    for (const promo of activePromotions) {
      if (!promotionTargetsAllPlans(promo)) continue;
      if (!promotionMeetsMinSpend(promo, undiscountedTotal)) continue;
      const discounted = computeDiscountedPrice(promo, baseRate);
      if (discounted === null || discounted >= baseRate) continue;
      if (!best || discounted < best.discountedUnit) {
        best = { promo, discountedUnit: discounted, unitSavings: baseRate - discounted };
      }
    }
    return best;
  }, [activePromotions, baseRate, undiscountedTotal, sessionCount]);

  const amount = sessionDiscount ? sessionDiscount.discountedUnit : baseRate;
  const totalAmount = amount * sessionCount;
  const totalSavings = sessionDiscount ? sessionDiscount.unitSavings * sessionCount : 0;

  const myRedemptions = useMemo(
    () => (promotionRedemptions || []).filter((r) => r.member?.id === member?.id || r.memberId === member?.id),
    [promotionRedemptions, member?.id],
  );

  const trainerOptions = useMemo(() => availableTrainers.map((t) => ({
    value: t.name,
    label: t.name,
    description: `${peso(t.sessionPrice)} / session · ${t.specialty}`,
  })), [availableTrainers]);

  const paymentOptions = useMemo(() => PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })), []);

  const addDate = () => {
    const dateError = getBookingDateError(date, getBookingToday());
    if (dateError) { setBookingError(dateError); return; }
    if (dates.includes(date)) { setBookingError('That session date has already been added.'); return; }
    setDates(prev => [...prev, date].sort());
    setDate('');
    setBookingError('');
  };

  const removeDate = (selectedDate) => {
    setDates(prev => prev.filter(d => d !== selectedDate));
  };

  const goPayment = (e) => {
    e.preventDefault();
    const dateError = getBookingDatesError(dates, getBookingToday());
    if (dateError) { setBookingError(dateError); return; }
    if (!time) return;
    setBookingError('');
    setStep(1);
  };

  const processPayment = (e) => {
    e.preventDefault();
    if (processingLock.current) return;
    const dateError = getBookingDatesError(dates, getBookingToday());
    if (dateError) {
      setBookingError(dateError);
      setStep(0);
      return;
    }

    processingLock.current = true;
    setProcessing(true);
    try {
      const fees = getConfiguredPaymentFee(method, totalAmount);
      const transaction = createSimulatedTransaction({
        member: member?.name || 'Member',
        type: `PT Sessions (${trainerName}) × ${dates.length}`,
        amount: totalAmount,
        method,
        date: today || new Date().toLocaleDateString('en-PH'),
        fees,
      });
      setTransactions?.(prev => [transaction, ...prev]);
      setPayment({ transaction, fees, id: 'S-' + Date.now() });
    } catch (error) {
      processingLock.current = false;
      setProcessing(false);
      setBookingError('The payment could not be started. Please review your selection and try again.');
      if (error instanceof Error) console.error(error);
    }
  };

  const updatePaymentState = (paymentState) => {
    if (!payment) return;
    const transaction = updateSimulatedTransaction(payment.transaction, paymentState);
    setPayment({ ...payment, transaction });
    setTransactions?.(prev => prev.map(tx => tx.id === transaction.id ? transaction : tx));
  };

  const completePayment = (paymentState) => {
    if (paymentState !== 'Successful') {
      setBookingError('Simulated payment failed. No session was booked.');
      return;
    }
    const currentDateError = getBookingDatesError(dates, getBookingToday());
    if (currentDateError) {
      updatePaymentState('Failed');
      setBookingError(currentDateError);
      return false;
    }
    const persistenceError = onPersistBookings?.({
      id: payment.id,
      receiptNumber: payment.transaction.receiptNumber,
      trainer: trainerName,
      dates,
      time,
      amount,
      totalAmount,
      method,
      promoCode: sessionDiscount?.promo?.code || null,
      savings: totalSavings,
      transaction: payment.transaction,
    });
    if (persistenceError) {
      updatePaymentState('Failed');
      setBookingError(persistenceError);
      return false;
    }
    setConfirmedId(payment.id);
    setReceiptNumber(payment.transaction.receiptNumber);
    setProcessing(false);
    processingLock.current = false;
    setStep(2);
    return true;
  };

  const closePayment = () => {
    setPayment(null);
    setProcessing(false);
    processingLock.current = false;
  };

  return (
    <Modal title="Book Coaching Session" onClose={onClose} dismissible={!payment} wide showCloseButton={step !== 2 && !payment}>
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
                <Dropdown
                  value={trainerName}
                  onChange={setTrainerName}
                  options={trainerOptions}
                  ariaLabel="Select a trainer"
                  fullWidth
                />
              </Field>
              <Field label="Session Rate">
                {sessionDiscount ? (
                  <div className="checkout-rate price-with-discount">
                    <s className="member-plan-price-old">{peso(baseRate)}</s>
                    <strong>{peso(amount)}</strong>
                    <span className="member-plan-price-saved">with {sessionDiscount.promo.code}</span>
                  </div>
                ) : (
                  <input className="form-control mono" value={peso(baseRate)} readOnly />
                )}
              </Field>
              <Field label="Session dates">
                <div className="booking-date-picker">
                  <input
                    className="form-control"
                    type="date"
                    value={date}
                    min={minDate}
                    onChange={e => { setDate(e.target.value); setBookingError(''); }}
                    aria-label="Choose a session date"
                    aria-invalid={Boolean(bookingError)}
                  />
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={addDate}
                    disabled={!date}
                  >
                    Add date
                  </button>
                </div>
                {bookingError && step === 0 && <p role="alert" style={{ color: 'var(--danger, #dc3545)', fontSize: 13, margin: '6px 0 0' }}>{bookingError}</p>}
                <div className="booking-selected-dates" aria-live="polite">
                  {dates.length ? dates.map(selectedDate => (
                    <div className="booking-selected-date" key={selectedDate}>
                      <span>{selectedDate}</span>
                      <button
                        type="button"
                        onClick={() => removeDate(selectedDate)}
                        aria-label={`Remove ${selectedDate}`}
                      >
                        ×
                      </button>
                    </div>
                  )) : (
                    <span className="booking-date-hint">Choose a date and add it. You can add several days.</span>
                  )}
                </div>
              </Field>
              <Field label="Time"><TextInput type="time" required value={time} onChange={setTime} /></Field>
            </div>
            <p className="booking-total-preview">
              {dates.length} session{dates.length === 1 ? '' : 's'} · Total {peso(totalAmount)}
              {totalSavings > 0 && <span className="member-plan-price-saved"> · you save {peso(totalSavings)}</span>}
            </p>
            {bookingError && <p role="alert" style={{ color: 'var(--danger, #dc3545)', fontSize: 13, margin: '0 0 12px' }}>{bookingError}</p>}
            {promotions && setPromotions && member && (
              <BookingRedeemCode
                promotions={promotions}
                redemptions={myRedemptions}
                setPromotions={setPromotions}
                setPromotionRedemptions={setPromotionRedemptions}
                member={member}
                onRedeemed={() => { /* re-render via prop changes */ }}
              />
            )}
            <button className="btn btn-signal btn-block" type="submit" disabled={!dates.length || !time}>Continue to Payment</button>
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
              <div className="row"><span>Session dates</span><span className="mono booking-date-summary">{dates.join(', ')}</span></div>
              <div className="row"><span>Time for each session</span><span className="mono">{time}</span></div>
              <div className="row"><span>Rate per session</span><span className="mono">
                {sessionDiscount
                  ? <><s style={{opacity:.6, marginRight:6}}>{peso(baseRate)}</s>{peso(amount)}</>
                  : peso(baseRate)}
              </span></div>
              {sessionDiscount && (
                <div className="row">
                  <span>Promo applied</span>
                  <span className="mono">{sessionDiscount.promo.code} · −{peso(totalSavings)}</span>
                </div>
              )}
              <div className="row" style={{fontWeight:700}}><span>Total Due ({dates.length} sessions)</span><span className="mono">{peso(totalAmount)}</span></div>
            </div>
            <Field label="Payment Method">
              <Dropdown
                value={method}
                onChange={setMethod}
                options={paymentOptions}
                ariaLabel="Select a payment method"
                fullWidth
              />
            </Field>
            <div style={{display:'flex', gap:8}}>
              <button type="button" className="btn btn-outline" onClick={()=>setStep(0)} disabled={processing}>Back</button>
              <button className="btn btn-signal btn-block" type="submit" disabled={processing} aria-busy={processing}>
                {processing
                  ? <><span className="vm-spinner" style={{marginRight:8}}/>Processing Payment…</>
                  : `Pay ${peso(totalAmount)}`}
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
            <h3 style={{textAlign:'center', fontSize:19.8, marginBottom:4}}>Booking Confirmed</h3>
            <p style={{textAlign:'center', color:'var(--steel)', fontSize:13.8, marginBottom:16}}>A confirmation has been sent to your email.</p>
            <div className="receipt-print-root">
              <ReceiptDocument
                transaction={{
                  id: confirmedId,
                  receiptNumber,
                  member: member?.name || 'Member',
                  type: `PT Sessions (${trainerName}) · ${dates.join(', ')}${totalSavings > 0 ? ` · promo ${sessionDiscount?.promo?.code}` : ''}`,
                  amount: totalAmount,
                  method,
                  date: today || new Date().toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }),
                  transactionReference: payment?.transaction?.transactionReference,
                  fees: payment?.transaction?.fees || 0,
                  paymentState: step === 2 ? 'Successful' : (payment?.transaction?.paymentState || 'Pending'),
                  isSimulated: true,
                  status: step === 2 ? 'Paid' : (payment?.transaction?.status || 'Pending'),
                }}
                member={member}
              />
              <div className="receipt-export-controls">
                <button className="btn btn-outline" onClick={onComplete}>Done</button>
                <button className="btn btn-signal" onClick={()=>window.print()}>Download PDF</button>
              </div>
            </div>
          </motion.div>
        )}
        {payment && <PaymentSimulationModal
          method={method}
          amount={totalAmount}
          fees={payment.fees}
          onStateChange={updatePaymentState}
          onComplete={completePayment}
          onClose={closePayment}
        />}
      </AnimatePresence>
    </Modal>
  );
}

export default BookingCheckoutModal;