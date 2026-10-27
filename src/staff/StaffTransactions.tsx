// @ts-nocheck
import { useState } from 'react';
import { StatTile, TabbedCard, Table, Modal, ReceiptDocument } from '../shared';
import { peso } from '../data.ts';
import { getReceiptReference } from '../receipt.ts';

function StaffTransactions({ transactions, members = [], toast }) {
  const today = new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
  const todays = (transactions || []).filter(t => t.date === today);
  const todayTotal = todays.filter(t=>t.status==='Paid' && !t.isSimulated).reduce((a,t)=>a+t.amount,0);
  const refunds = transactions.filter(t => t.status==='Refunded').length;
  const [viewTxn, setViewTxn] = useState(null);
  const [documentType, setDocumentType] = useState('Receipt');
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async () => {
    if (!viewTxn || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch('/api/staff/transactions/pdf', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionId: viewTxn.id, documentType }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Could not download the PDF.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `VinAthletics-${documentType.toLowerCase()}-${getReceiptReference(viewTxn).replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not download the PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="grid grid-3" style={{marginBottom:18}}>
        <StatTile label="Transactions Today" value={todays.length}/>
        <StatTile label="Today's Sales" value={peso(todayTotal)} tone="court"/>
        <StatTile label="Refunds" value={refunds} tone="steel"/>
      </div>
      <TabbedCard title={"My Transactions — Today, " + today}>
        {todays.length === 0 ? (
          <div style={{fontSize:14.3, color:'var(--steel)', padding:'10px 0'}}>No transactions yet today. Use the Point of Sale to record one.</div>
        ) : (
          <Table columns={['Transaction reference','Receipt reference','Member','Type','Amount','Fees','Method','Status','']} rows={todays} renderRow={t=>(
            <tr key={t.id}>
              <td className="mono">{t.transactionReference || t.id}</td><td className="mono">{t.receiptNumber || t.id}</td><td>{t.member}</td><td>{t.type}{t.isSimulated && <small className="payment-simulated-tag">Simulated test payment</small>}</td><td className="mono">{peso(t.amount)}</td><td className="mono">{peso(t.fees || 0)}</td><td>{t.method}</td><td>{t.status}</td>
              <td className="payment-history-actions">
                <button className="btn btn-outline btn-sm" onClick={()=>{setDocumentType('Invoice');setViewTxn(t);}}>View Invoice</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>{setDocumentType('Receipt');setViewTxn(t);}}>View Receipt</button>
              </td>
            </tr>
          )} />
        )}
      </TabbedCard>

      {viewTxn && (
        <Modal title={documentType} className="receipt-print-modal" showCloseButton={false} onClose={()=>setViewTxn(null)}>
          <div className="receipt-print-root">
            <ReceiptDocument transaction={viewTxn} member={members.find((member) => member.name === viewTxn.member)} documentType={documentType} />
            <div className="receipt-export-controls">
              <button className="btn btn-outline" onClick={()=>setViewTxn(null)}>Close</button>
              <button className="btn btn-signal" onClick={downloadPdf} disabled={downloading}>
                {downloading ? 'Preparing PDF…' : 'Download PDF'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default StaffTransactions;
