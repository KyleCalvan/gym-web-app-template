import type { Transaction } from '../types.ts';
import { formatMoney as peso } from './utils/money';
import { getReceiptReference } from '../receipt.ts';

interface ReceiptMember {
  id?: string;
  displayId?: string;
  name: string;
  email?: string;
  phone?: string;
}

interface ReceiptDocumentProps {
  transaction: Transaction;
  member?: ReceiptMember | null;
  documentType?: 'Receipt' | 'Invoice';
}

export function ReceiptDocument({ transaction, member, documentType = 'Receipt' }: ReceiptDocumentProps) {
  const fees = Number(transaction.fees) || 0;
  const total = Number(transaction.amount) + fees;

  return (
    <article className="receipt-document" aria-label={`${documentType} ${getReceiptReference(transaction)}`}>
      <header className="receipt-brand">
        <img src="/logo.jpg" alt="" className="receipt-logo" />
        <div>
          <p className="receipt-eyebrow">{documentType}</p>
          <h2>VinAthletics Gym</h2>
          <address>
            123 Bonifacio St., Makati<br />
            +63 917 555 0142 · hello@vinathletics.gym
          </address>
        </div>
        <div className="receipt-number">
          <span>{documentType} no.</span>
          <strong>{getReceiptReference(transaction)}</strong>
        </div>
      </header>

      <section className="receipt-meta" aria-label="Payment details">
        <div>
          <span>Payment date</span>
          <strong>{transaction.date || '—'}</strong>
        </div>
        <div>
          <span>Transaction reference</span>
          <strong>{transaction.transactionReference || transaction.id}</strong>
        </div>
        <div>
          <span>Payment method</span>
          <strong>{transaction.method || '—'}</strong>
        </div>
        <div>
          <span>Payment status</span>
          <strong className={`receipt-status receipt-status-${(transaction.status || 'Pending').toLowerCase()}`}>
            {transaction.status || 'Pending'}
          </strong>
        </div>
      </section>

      <section className="receipt-member">
        <span className="receipt-section-label">Billed to</span>
        <strong>{member?.name || transaction.member || 'Walk-in'}</strong>
        {member?.id && <span>Member ID · {member.displayId || member.id}</span>}
        {member?.email && <span>{member.email}</span>}
        {member?.phone && <span>{member.phone}</span>}
      </section>

      <section className="receipt-items" aria-label="Purchased items">
        <div className="receipt-items-head">
          <span>Description / purchased plan</span>
          <span>Amount</span>
        </div>
        <div className="receipt-item">
          <span>{transaction.type || 'Gym purchase'}</span>
          <strong>{peso(transaction.taxDetails?.subtotal ?? transaction.amount)}</strong>
        </div>
      </section>

      <section className="receipt-totals" aria-label="Payment totals">
        {transaction.taxDetails ? <>
          <div><span>Subtotal</span><strong>{peso(transaction.taxDetails.subtotal)}</strong></div>
          {transaction.taxDetails.mode === 'inclusive' && <div><span>Taxable amount</span><strong>{peso(transaction.taxDetails.base)}</strong></div>}
          <div><span>VAT / tax ({transaction.taxDetails.rate}%{transaction.taxDetails.mode === 'inclusive' ? ', included' : ''})</span><strong>{peso(transaction.taxDetails.amount)}</strong></div>
        </> : <div><span>Amount</span><strong>{peso(transaction.amount)}</strong></div>}
        {fees > 0 && <div><span>Fees</span><strong>{peso(fees)}</strong></div>}
        <div><span>Payment status</span><strong>{transaction.paymentState || transaction.status}</strong></div>
        <div className="receipt-grand-total"><span>{transaction.status === 'Paid' ? 'Total paid' : 'Total due'}</span><strong>{peso(total)}</strong></div>
      </section>

      <footer className="receipt-footer">
        {transaction.isSimulated && <strong>SIMULATED TEST TRANSACTION — NO REAL PAYMENT WAS PROCESSED.<br /></strong>}
        Thank you for choosing VinAthletics. Please retain this receipt for your records.
      </footer>
    </article>
  );
}
