// @ts-nocheck
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Modal, AnimatedStepTrack, Field, TextInput, Select } from '../shared';
import { peso } from '../data.ts';
import { dur, ease, spring } from '../motion.tsx';

function BookingCheckoutModal({ initialTrainer, trainers = [], onClose, onComplete, onPersistBookings }){
  const [step, setStep] = useState(0);
  const [trainerName, setTrainerName] = useState(initialTrainer || trainers[0]?.name || '');
  const [date, setDate] = useState('');
  const [dates, setDates] = useState([]);
  const [time, setTime] = useState('');
  const [method, setMethod] = useState('GCash');
  const [processing, setProcessing] = useState(false);
  const [confirmedId, setConfirmedId] = useState(null);
  const [amount] = useState(900);
  const totalAmount = amount * dates.length;
  const now = new Date();
  const minDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const addDate = () => {
    if (!date || date < minDate || dates.includes(date)) return;
    setDates(prev => [...prev, date].sort());
    setDate('');
  };

  const removeDate = (selectedDate) => {
    setDates(prev => prev.filter(d => d !== selectedDate));
  };

  const goPayment = (e) => {
    e.preventDefault();
    if (!dates.length || !time) return;
    setStep(1);
  };

  const processPayment = (e) => {
    e.preventDefault();
    setProcessing(true);
    setTimeout(()=>{
      setProcessing(false);
      const id = 'S-' + Date.now();
      setConfirmedId(id);
      setStep(2);
      onPersistBookings && onPersistBookings({
        id,
        trainer: trainerName,
        dates,
        time,
        amount,
        totalAmount,
        method,
      });
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
                  {trainers.filter(t => !t.deletedAt && t.status !== 'Inactive').map(t=><option key={t.id}>{t.name}</option>)}
                </Select>
              </Field>
              <Field label="Session Rate">
                <input className="form-control mono" value={peso(amount)} readOnly />
              </Field>
              <Field label="Session dates">
                <div className="booking-date-picker">
                  <input
                    className="form-control"
                    type="date"
                    value={date}
                    min={minDate}
                    onChange={e => setDate(e.target.value)}
                    aria-label="Choose a session date"
                  />
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={addDate}
                    disabled={!date || date < minDate || dates.includes(date)}
                  >
                    Add date
                  </button>
                </div>
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
            </p>
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
              <div className="row"><span>Rate per session</span><span className="mono">{peso(amount)}</span></div>
              <div className="row" style={{fontWeight:700}}><span>Total Due ({dates.length} sessions)</span><span className="mono">{peso(totalAmount)}</span></div>
            </div>
            <Field label="Payment Method">
              <div className="pay-method-grid">
                {['GCash','Cash'].map(m=>(
                  <div key={m} className={"pay-method"+(method===m?' active':'')} onClick={()=>setMethod(m)}>{m}</div>
                ))}
              </div>
            </Field>
            <div style={{display:'flex', gap:8}}>
              <button type="button" className="btn btn-outline" onClick={()=>setStep(0)} disabled={processing}>Back</button>
              <button className="btn btn-signal btn-block" type="submit" disabled={processing}>
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
            <motion.div
              className="receipt"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.base, delay: 0.12, ease: ease.out }}
            >
              <div style={{textAlign:'center', fontFamily:'var(--font-display)', fontSize:16.5}}>VINATHLETICS GYM</div>
              <div style={{textAlign:'center', fontSize:11.6, color:'var(--steel)'}}>Session Receipt · {confirmedId}</div>
              <hr/>
              <div className="row"><span>Trainer</span><span>{trainerName}</span></div>
              <div className="row"><span>Session dates</span><span>{dates.join(', ')}</span></div>
              <div className="row"><span>Time</span><span>{time}</span></div>
              <div className="row"><span>Method</span><span>{method}</span></div>
              <hr/>
              <div className="row" style={{fontWeight:700}}><span>TOTAL PAID</span><span>{peso(totalAmount)}</span></div>
            </motion.div>
            <button className="btn btn-signal btn-block" style={{marginTop:14}} onClick={onComplete}>Done</button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

export default BookingCheckoutModal;