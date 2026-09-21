// @ts-nocheck
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Modal, Field, TextInput } from '../shared';
import { dur, ease } from '../motion.tsx';

function EditBookingModal({ booking, onClose, onSave, onCancelBooking }){
  const [tab, setTab] = useState('modify');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

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
            onSubmit={e=>{e.preventDefault(); onSave(booking.id, {date: date||booking.date, time: time||booking.time}); onClose();}}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            <p style={{fontSize:12.5, color:'var(--steel)', marginBottom:12}}>
              Currently scheduled with <b>{booking.trainer}</b> on <span className="mono">{booking.date}, {booking.time}</span>.
            </p>
            <div className="grid grid-2">
              <Field label="New Date"><TextInput type="date" onChange={setDate} /></Field>
              <Field label="New Time"><TextInput type="time" onChange={setTime} /></Field>
            </div>
            <button className="btn btn-signal btn-block" type="submit">Save Changes</button>
          </motion.form>
        ) : (
          <motion.div
            key="cancel"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            <p style={{fontSize:12.5, color:'var(--steel)', marginBottom:14}}>
              This will cancel your session with <b>{booking.trainer}</b> on <span className="mono">{booking.date}, {booking.time}</span>.
              {booking.paid ? ' Paid sessions are refunded to your original payment method.' : ''}
            </p>
            <button className="btn btn-danger btn-block" onClick={()=>{onCancelBooking(booking.id); onClose();}}>Confirm Cancellation</button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

export default EditBookingModal;