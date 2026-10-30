import { useState } from 'react';
import { Modal } from '../shared';
import { formatMoney as peso } from '../shared/utils/money';
import type { Member, Transaction } from '../types';
import StaffPaymentReceipt from './StaffPaymentReceipt';

export default function StaffGcashSimulationModal({ amount, fees, member, onSimulate, onClose }: {
  amount: number;
  fees: number;
  member?: Member | null;
  onSimulate: () => Promise<Transaction>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [viewReceipt, setViewReceipt] = useState(false);

  async function simulate() {
    if (pending) return;
    setPending(true); setError('');
    try { setReceipt(await onSimulate()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record the test payment.'); }
    finally { setPending(false); }
  }

  if (receipt && viewReceipt) return <Modal title="Receipt" className="receipt-print-modal" onClose={onClose}
    showCloseButton={false}>
    <StaffPaymentReceipt transaction={receipt} member={member} onBack={() => setViewReceipt(false)} onClose={onClose} />
  </Modal>;

  return <Modal title="GCash payment simulation" onClose={onClose}
    dismissible={!pending} showCloseButton={!pending}>
    <div className="payment-simulation">
      <p className="payment-simulation-banner" role="note">
        Test mode only. No GCash payment will be collected, and this transaction will not activate a membership.
      </p>
      <div className="payment-simulation-summary">
        <div><span>Amount</span><strong>{peso(amount)}</strong></div>
        {fees > 0 && <div><span>Test fee</span><strong>{peso(fees)}</strong></div>}
        <div><span>Total (test)</span><strong>{peso(amount + fees)}</strong></div>
        {receipt && <div><span>Test receipt</span><strong>{receipt.receiptNumber}</strong></div>}
      </div>
      {error && <p className="payment-simulation-error" role="alert">{error}</p>}
      <div className="payment-simulation-actions">
        {receipt ? <>
          <button type="button" className="btn btn-outline" onClick={() => setViewReceipt(true)}>View receipt</button>
          <button type="button" className="btn btn-signal" onClick={onClose}>Done</button>
        </> : <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="button" className="btn btn-signal" onClick={() => void simulate()} disabled={pending}>
            {pending ? 'Recording test…' : 'Simulate GCash payment'}
          </button>
        </>}
      </div>
    </div>
  </Modal>;
}
