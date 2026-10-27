// @ts-nocheck
import { useState } from 'react';
import { StatTile, Badge, Table, Modal, Field, TabbedCard, ReceiptDocument } from '../shared';
import { peso } from '../data.ts';

function AdminPayments({ transactions, setTransactions, members = [], today, toast, addAudit, onAdminAction }){
  const [showRefund, setShowRefund] = useState(null);
  const [reason, setReason] = useState('');
  const [showReceipts, setShowReceipts] = useState(false);
  const [viewTxn, setViewTxn] = useState(null);
  const [documentType, setDocumentType] = useState('Receipt');

  const confirmRefund = async () => {
    if (!showRefund) return;
    try { await onAdminAction('payment.refund', { id: showRefund.id, reason }); }
    catch (error) { toast(error instanceof Error ? error.message : 'Refund could not be saved.'); return; }
    toast('Transaction ' + showRefund.id + ' refunded — ' + peso(showRefund.amount));
    addAudit?.('warn', 'Transaction refunded', showRefund.id + ' — ' + showRefund.member + ' (' + peso(showRefund.amount) + ')');
    setReason('');
    setShowRefund(null);
  };

  const paid = transactions.filter(t=>t.status==='Paid');
  const todayRevenue = transactions.filter(t=>t.date===today && t.status==='Paid').reduce((a,t)=>a+t.amount,0);
  const pendingCount = transactions.filter(t=>t.status==='Pending').length;
  const refundedMtd = transactions.filter(t=>t.status==='Refunded').reduce((a,t)=>a+t.amount,0);

  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Today's Revenue" value={peso(todayRevenue)} tone="court"/>
        <StatTile label="Transactions Today" value={transactions.filter(t=>t.date===today).length}/>
        <StatTile label="Pending" value={pendingCount} tone="amber"/>
        <StatTile label="Refunded (MTD)" value={peso(refundedMtd)} tone="steel"/>
      </div>
      <TabbedCard title="All Transactions" right={<button className="btn btn-outline btn-sm" onClick={()=>setShowReceipts(true)}>View Receipts</button>}>
        {transactions.length === 0 ? <div className="payment-history-state">No transactions have been recorded yet.</div> : <Table columns={['Transaction reference','Receipt reference','Member','Type','Amount','Fees','Method','Date','Status','']} rows={transactions} renderRow={t=>(
          <tr key={t.id}>
            <td className="mono">{t.transactionReference || t.id}</td>
            <td className="mono">{t.receiptNumber || t.id}</td>
            <td>{t.member}</td>
            <td>{t.type}{t.isSimulated && <small className="payment-simulated-tag">Simulated test payment</small>}</td>
            <td className="mono">{peso(t.amount)}</td>
            <td className="mono">{peso(t.fees || 0)}</td>
            <td>{t.method}</td>
            <td className="mono">{t.date}</td>
            <td><Badge status={t.status}/></td>
            <td style={{display:'flex', gap:6}}>
              <button className="btn btn-outline btn-sm" onClick={()=>{setDocumentType('Invoice');setViewTxn(t);}}>View Invoice</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setDocumentType('Receipt');setViewTxn(t);}}>View Receipt</button>
              {t.status==='Paid' && <button className="btn btn-ghost btn-sm" onClick={()=>{setShowRefund(t); setReason('');}}>Refund</button>}
            </td>
          </tr>
        )} />}
      </TabbedCard>

      {showRefund && (
        <Modal title="Refund / Void Transaction" showCloseButton={false} onClose={()=>setShowRefund(null)}>
          <p style={{fontSize:14.3, color:'var(--steel)', marginBottom:14}}>You are about to refund <b className="mono">{showRefund.id}</b> — {peso(showRefund.amount)} paid by {showRefund.member}.</p>
          <Field label="Reason"><textarea className="form-control" rows="3" placeholder="Reason for refund…" value={reason} onChange={e=>setReason(e.target.value)} /></Field>
          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-danger" onClick={confirmRefund}>Confirm Refund</button>
            <button className="btn btn-outline" onClick={()=>setShowRefund(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {showReceipts && (
        <Modal title="Generate Receipt" onClose={()=>setShowReceipts(false)}>
          <p style={{fontSize:13.8, color:'var(--steel)', marginBottom:10}}>Pick a recent paid transaction to view/print a receipt.</p>
          {paid.length === 0 ? (
            <div style={{fontSize:14.3, color:'var(--steel)'}}>No paid transactions available.</div>
          ) : (
            <Table columns={['ID','Member','Amount','Method','']} rows={paid.slice(0,8)} renderRow={t=>(
              <tr key={t.id}>
                <td className="mono">{t.id}</td>
                <td>{t.member}</td>
                <td className="mono">{peso(t.amount)}</td>
                <td>{t.method}</td>
                <td><button className="btn btn-outline btn-sm" onClick={()=>{setDocumentType('Receipt');setViewTxn(t); setShowReceipts(false);}}>View Receipt</button></td>
              </tr>
            )} />
          )}
        </Modal>
      )}

      {viewTxn && (
        <Modal title={documentType} className="receipt-print-modal" showCloseButton={false} onClose={()=>setViewTxn(null)}>
          <div className="receipt-print-root">
            <ReceiptDocument transaction={viewTxn} member={members.find((member) => member.name === viewTxn.member)} documentType={documentType} />
            <div className="receipt-export-controls">
              <button className="btn btn-outline" onClick={()=>setViewTxn(null)}>Close</button>
              <button className="btn btn-signal" onClick={()=>{window.print(); toast('Print dialog opened');}}>Download PDF</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default AdminPayments;
