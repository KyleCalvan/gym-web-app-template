// @ts-nocheck
import { useState } from 'react';
import { Badge, Table, TabbedCard, Modal, ReceiptDocument, Select } from '../shared';
import { peso } from '../data.ts';

const PAYMENT_METHODS = ['GCash', 'Card', 'Cash'];

function MemberPayments({ transactions, members, currentUserId, toast, preferredPaymentMethod = 'GCash', setPreferredPaymentMethod }){
  const [receipt, setReceipt] = useState(null);
  const [documentType, setDocumentType] = useState('Invoice');
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(preferredPaymentMethod);
  const [historyError, setHistoryError] = useState('');
  const me = members.find(m => m.id === currentUserId) || members[0];
  const mine = Array.isArray(transactions)
    ? (me ? transactions.filter(t => t.member === me.name) : transactions)
    : [];

  const openDocument = (transaction, type) => {
    setDocumentType(type);
    setReceipt(transaction);
  };

  const savePaymentMethod = () => {
    if (!PAYMENT_METHODS.includes(selectedMethod)) {
      setHistoryError('Choose an available payment method.');
      return;
    }
    setPreferredPaymentMethod?.(selectedMethod);
    setShowPaymentMethod(false);
    setHistoryError('');
    toast(`Default payment method changed to ${selectedMethod}`);
  };

  return (
    <>
      <TabbedCard
        label="Finance"
        title="My Payment History"
        right={<button className="btn btn-outline btn-sm" onClick={() => { setSelectedMethod(preferredPaymentMethod); setShowPaymentMethod(true); }}>Switch Payment Method</button>}
      >
        {transactions === undefined ? (
          <div className="payment-history-state" role="status">Loading payment history…</div>
        ) : historyError ? (
          <div className="payment-history-state payment-history-error" role="alert">{historyError}</div>
        ) : mine.length === 0 ? (
          <div style={{fontSize:14.3, color:'var(--steel)', padding:'10px 0'}}>No payments yet. Your membership renewals and bookings will appear here.</div>
        ) : (
          <Table columns={['Transaction reference','Receipt reference','Type','Amount','Fees','Method','Date','Status','']} rows={mine} renderRow={t=>(
            <tr key={t.id}>
              <td className="mono">{t.transactionReference || t.id}</td><td className="mono">{t.receiptNumber || t.id}</td><td>{t.type}{t.isSimulated && <small className="payment-simulated-tag">Simulated test payment</small>}</td><td className="mono">{peso(t.amount)}</td><td className="mono">{peso(t.fees || 0)}</td><td>{t.method}</td><td className="mono">{t.date}</td>
              <td><Badge status={t.status}/></td>
              <td className="payment-history-actions">
                <button className="btn btn-outline btn-sm" onClick={()=>openDocument(t, 'Invoice')}>View Invoice</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>openDocument(t, 'Receipt')}>View Receipt</button>
              </td>
            </tr>
          )} />
        )}
      </TabbedCard>

      {showPaymentMethod && (
        <Modal title="Switch Payment Method" onClose={()=>setShowPaymentMethod(false)}>
          <p className="payment-method-note">Choose a default method for future purchases. This setting stores only your selection—not card numbers, PINs, or account credentials.</p>
          <Select value={selectedMethod} onChange={setSelectedMethod}>
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
          </Select>
          {selectedMethod === 'GCash' && <p className="payment-simulation-fee-note">Additional GCash fees may apply to real provider payments. Test fees are shown before simulated checkout.</p>}
          <div className="payment-simulation-actions">
            <button className="btn btn-outline" onClick={()=>setShowPaymentMethod(false)}>Cancel</button>
            <button className="btn btn-signal" onClick={savePaymentMethod}>Confirm Method</button>
          </div>
        </Modal>
      )}
      {receipt && (
        <Modal title={documentType} className="receipt-print-modal" showCloseButton={false} onClose={()=>setReceipt(null)}>
          <div className="receipt-print-root">
            <ReceiptDocument transaction={receipt} member={me} documentType={documentType} />
            <div className="receipt-export-controls">
              <button className="btn btn-outline" onClick={()=>setReceipt(null)}>Close</button>
              <button className="btn btn-signal" onClick={()=>{window.print(); toast('Print dialog opened');}}>Download PDF</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default MemberPayments;