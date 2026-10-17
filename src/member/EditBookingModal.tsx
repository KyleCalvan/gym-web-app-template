// @ts-nocheck
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Modal, Field, TextInput } from '../shared';
import { dur, ease } from '../motion.tsx';

function EditBookingModal({ booking, onClose, onSave, onCancelBooking }){
  const [tab, setTab] = useState('modify');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');

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
            onSubmit={e=>{e.preventDefault(); onSave(booking.id, {date: date||booking.date, time: time||booking.time, notes: reason}); onClose();}}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            <p style={{fontSize:13.8, color:'var(--steel)', marginBottom:12}}>
              Currently scheduled with <b>{booking.trainer}</b> on <span className="mono">{booking.date}, {booking.time}</span>.
            </p>
            <div className="grid grid-2">
              <Field label="New Date"><TextInput type="date" onChange={setDate} /></Field>
              <Field label="New Time"><TextInput type="time" onChange={setTime} /></Field>
            </div>
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