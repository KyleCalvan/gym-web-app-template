import { useState } from 'react';
import { Modal, Field } from '../shared';
import { formatMoney as peso } from '../shared/utils/money';
import type { Member, Transaction } from '../types';
import StaffPaymentReceipt from './StaffPaymentReceipt';
import { MAX_STAFF_POS_AMOUNT } from './posPricing';

export default function StaffCashPaymentModal({ amount, member, onConfirm, onClose }: {
  amount: number;
  member?: Member | null;
  onConfirm: (cashReceived: number) => Promise<Transaction>;
  onClose: () => void;
}) {
  const [received, setReceived] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [viewReceipt, setViewReceipt] = useState(false);
  const cash = Number(received);
  const validCash = received.trim() !== '' && Number.isFinite(cash) && cash >= 0
    && cash <= MAX_STAFF_POS_AMOUNT && /^\d+(?:\.\d{1,2})?$/.test(received);
  const enough = validCash && Math.round(cash * 100) >= Math.round(amount * 100);

  async function confirm() {
    if (pending || !enough) return;
    setPending(true); setError('');
    try { setReceipt(await onConfirm(cash)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record the payment.'); }
    finally { setPending(false); }
  }

  if (receipt && viewReceipt) return <Modal title="Receipt" className="receipt-print-modal" onClose={onClose}
    showCloseButton={false}>
    <StaffPaymentReceipt transaction={receipt} member={member} onBack={() => setViewReceipt(false)} onClose={onClose} />
  </Modal>;

  return <Modal title={receipt ? 'Payment recorded' : 'Cash payment'} onClose={onClose}
    dismissible={!pending} showCloseButton={!pending}>
    <div className="payment-simulation">
      <div className="payment-simulation-summary">
        <div><span>Amount due</span><strong>{peso(amount)}</strong></div>
        {!receipt && <div><span>Change</span><strong>{enough ? peso((Math.round(cash * 100) - Math.round(amount * 100)) / 100) : '—'}</strong></div>}
        {receipt && <div><span>Receipt</span><strong>{receipt.receiptNumber}</strong></div>}
      </div>
      {!receipt && <Field label="Cash received"><input className="form-control" type="number" min="0" max={MAX_STAFF_POS_AMOUNT} step="0.01"
        value={received} onChange={(event) => setReceived(event.target.value)} disabled={pending} required /></Field>}
      {!receipt && received.trim() && !validCash && <p className="payment-simulation-error" role="alert">
        Enter an amount from ₱0 to ₱10,000,000 with at most two decimal places.
      </p>}
      {error && <p className="payment-simulation-error" role="alert">{error}</p>}
      <div className="payment-simulation-actions">
        {receipt ? <>
          <button type="button" className="btn btn-outline" onClick={() => setViewReceipt(true)}>View receipt</button>
          <button type="button" className="btn btn-signal" onClick={onClose}>Done</button>
        </> : <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="button" className="btn btn-signal" onClick={() => void confirm()} disabled={pending || !enough}>
            {pending ? 'Recording…' : 'Confirm cash received'}
          </button>
        </>}
      </div>
    </div>
  </Modal>;
}
