// @ts-nocheck
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Modal, Field, TextInput } from '../shared';
import { dur, ease } from '../motion.tsx';
import { getBookingDateError, getBookingToday } from './bookingDates.ts';

function EditBookingModal({ booking, onClose, onSave, onCancelBooking }){
  const [tab, setTab] = useState('modify');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const minDate = getBookingToday();

  const saveChanges = (event) => {
    event.preventDefault();
    if (date) {
      const dateError = getBookingDateError(date, getBookingToday());
      if (dateError) { setError(dateError); return; }
    }

    const saveError = onSave(booking.id, {
      ...(date ? { date } : {}),
      ...(time ? { time } : {}),
      notes: reason,
    });
    if (saveError) { setError(saveError); return; }
    onClose();
  };

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
            onSubmit={saveChanges}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            <p style={{fontSize:13.8, color:'var(--steel)', marginBottom:12}}>
              Currently scheduled with <b>{booking.trainer}</b> on <span className="mono">{booking.date}, {booking.time}</span>.
            </p>
            <div className="grid grid-2">
              <Field label="New Date"><TextInput type="date" min={minDate} value={date} onChange={(value) => { setDate(value); setError(''); }} /></Field>
              <Field label="New Time"><TextInput type="time" onChange={setTime} /></Field>
            </div>
            {error && <p role="alert" style={{ color: 'var(--danger, #dc3545)', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
            <Field label="Notes for Trainer" style={{marginTop:12}}>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Reason for rescheduling..."
                value={reason}
                onChange={e=>setReason(e.target.value)}
              />
            </Field>
            <button className="btn btn-signal btn-block" type="submit" style={{marginTop:16}}>Save Changes</button>
          </motion.form>
        ) : (
          <motion.div
            key="cancel"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            <p style={{fontSize:13.8, color:'var(--steel)', marginBottom:14}}>
              This will cancel your session with <b>{booking.trainer}</b> on <span className="mono">{booking.date}, {booking.time}</span>.
              {booking.paid ? ' Paid sessions are refunded to your original payment method.' : ''}
            </p>
            <Field label="Cancellation Reason">
              <textarea
                className="form-control"
                rows={3}
                placeholder="Why are you cancelling?"
                value={reason}
                onChange={e=>setReason(e.target.value)}
              />
            </Field>
            <button
              className="btn btn-danger btn-block"
              style={{marginTop:16}}
              onClick={()=>{onCancelBooking(booking.id, reason); onClose();}}
            >
              Confirm Cancellation
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

export default EditBookingModal;