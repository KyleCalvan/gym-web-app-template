// @ts-nocheck
import { useState } from 'react';
import { Badge, Table, TabbedCard, Modal, ReceiptDocument, Select } from '../shared';
import { peso } from '../data.ts';

const PAYMENT_METHODS = ['GCash', 'Cash'];

function MemberPayments({ transactions, members, currentUserId, toast, preferredPaymentMethod = 'GCash', setPreferredPaymentMethod, onSavePaymentMethod, transactionsAreMine = false }){
  const [receipt, setReceipt] = useState(null);
  const [documentType, setDocumentType] = useState('Invoice');
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(preferredPaymentMethod);
  const [methodError, setMethodError] = useState('');
  const [savingMethod, setSavingMethod] = useState(false);
  const me = members.find(m => m.id === currentUserId) || members[0];
  const mine = Array.isArray(transactions)
    ? (transactionsAreMine ? transactions : me ? transactions.filter(t => t.member === me.name && !t.isSimulated) : transactions)
    : [];

  const openDocument = (transaction, type) => {
    setDocumentType(type);
    setReceipt(transaction);
  };

  const savePaymentMethod = async () => {
    if (!PAYMENT_METHODS.includes(selectedMethod)) {
      setMethodError('Choose an available payment method.');
      return;
    }
    setMethodError('');
    setSavingMethod(true);
    try {
      if (onSavePaymentMethod) await onSavePaymentMethod(selectedMethod);
      else setPreferredPaymentMethod?.(selectedMethod);
      setShowPaymentMethod(false);
      toast(`Preferred payment method changed to ${selectedMethod}`);
    } catch (error) {
      setMethodError(error instanceof Error ? error.message : 'Payment preference could not be saved.');
    } finally {
      setSavingMethod(false);
    }
  };

  return (
    <>
      <TabbedCard
        title="My Payment History"
        right={<button className="btn btn-outline btn-sm" onClick={() => { setSelectedMethod(preferredPaymentMethod); setMethodError(''); setShowPaymentMethod(true); }}>Switch Payment Method</button>}
      >
        {transactions === undefined ? (
          <div className="payment-history-state" role="status">Loading payment history…</div>
        ) : mine.length === 0 ? (
          <div style={{fontSize:14.3, color:'var(--steel)', padding:'10px 0'}}>No payments yet. Your membership renewals and bookings will appear here.</div>
        ) : (
          <Table columns={['Transaction reference','Receipt reference','Type','Amount','Fees','Method','Date','Status','']} rows={mine} renderRow={t=>(
            <tr key={t.id}>
              <td className="mono">{t.transactionReference || t.id}</td><td className="mono">{t.receiptNumber || t.id}</td><td>{t.type}{t.isSimulated && <small className="payment-simulated-tag">Simulated test payment</small>}</td><td className="mono">{peso(t.amount)}</td><td className="mono">{peso(t.fees || 0)}</td><td>{t.method}</td><td className="mono">{t.date}</td>
              <td><Badge status={t.status}/></td>
              <td className="payment-history-actions">
                <button className="btn btn-outline btn-sm" onClick={()=>openDocument(t, 'Invoice')}>View Invoice</button>
                {(t.status === 'Paid' || t.status === 'Refunded') &&
                  <button className="btn btn-ghost btn-sm" onClick={()=>openDocument(t, t.receiptNumber ? 'Receipt' : 'Payment Record')}>{t.receiptNumber ? 'View Receipt' : 'View Payment Record'}</button>}
              </td>
            </tr>
          )} />
        )}
      </TabbedCard>

      {showPaymentMethod && (
        <Modal title="Switch Payment Method" onClose={()=>setShowPaymentMethod(false)}>
          <p className="payment-method-note">Save your preferred method on your member profile. Online test checkout currently uses GCash.</p>
          <Select value={selectedMethod} onChange={setSelectedMethod}>
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
          </Select>
          {selectedMethod === 'GCash' && <p className="payment-simulation-fee-note">Additional GCash fees may apply to real provider payments. Test fees are shown before simulated checkout.</p>}
          {methodError && <p role="alert">{methodError}</p>}
          <div className="payment-simulation-actions">
            <button className="btn btn-outline" onClick={()=>setShowPaymentMethod(false)} disabled={savingMethod}>Cancel</button>
            <button className="btn btn-signal" onClick={() => void savePaymentMethod()} disabled={savingMethod}>{savingMethod ? 'Saving…' : 'Confirm Method'}</button>
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
