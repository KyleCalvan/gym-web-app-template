import { ReceiptDocument } from '../shared';
import type { Transaction } from '../types';

export default function StaffPaymentReceipt({ transaction, member, onBack, onClose }: {
  transaction: Transaction;
  member?: { id?: string; displayId?: string; name: string; email?: string; phone?: string } | null;
  onBack: () => void;
  onClose: () => void;
}) {
  return <div className="receipt-print-root">
    <ReceiptDocument transaction={transaction} member={member && { ...member, id: member.displayId || member.id }} />
    <div className="receipt-export-controls">
      <button type="button" className="btn btn-outline" onClick={onBack}>Back</button>
      <button type="button" className="btn btn-outline" onClick={() => window.print()}>Print / save PDF</button>
      <button type="button" className="btn btn-signal" onClick={onClose}>Done</button>
    </div>
  </div>;
}
