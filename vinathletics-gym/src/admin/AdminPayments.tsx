// @ts-nocheck
import { useState } from 'react';
import { StatTile, Badge, Table, Modal, Field, TabbedCard } from '../shared';
import { peso } from '../data.ts';

function AdminPayments({ transactions, setTransactions, today, toast }){
  const [showRefund, setShowRefund] = useState(null);
  const [reason, setReason] = useState('');
  const [showReceipts, setShowReceipts] = useState(false);
  const [viewTxn, setViewTxn] = useState(null);

  const confirmRefund = () => {
    if (!showRefund) return;
    setTransactions(prev => prev.map(t => t.id===showRefund.id ? {...t, status:'Refunded', reason} : t));
    toast('Transaction ' + showRefund.id + ' refunded — ' + peso(showRefund.amount));
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
      <TabbedCard label="Finance" title="All Transactions" right={<button className="btn btn-outline btn-sm" onClick={()=>setShowReceipts(true)}>Generate Receipt</button>}>
        <Table columns={['ID','Member','Type','Amount','Method','Date','Status','']} rows={transactions} renderRow={t=>(
          <tr key={t.id}>
            <td className="mono">{t.id}</td>
            <td>{t.member}</td>
            <td>{t.type}</td>
            <td className="mono">{peso(t.amount)}</td>
            <td>{t.method}</td>
            <td className="mono">{t.date}</td>
            <td><Badge status={t.status}/></td>
            <td style={{display:'flex', gap:6}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setViewTxn(t)}>View</button>
              {t.status==='Paid' && <button className="btn btn-ghost btn-sm" onClick={()=>{setShowRefund(t); setReason('');}}>Refund</button>}
            </td>
          </tr>
        )} />
      </TabbedCard>

      {showRefund && (
        <Modal title="Refund / Void Transaction" onClose={()=>setShowRefund(null)}>
          <p style={{fontSize:13, color:'var(--steel)', marginBottom:14}}>You are about to refund <b className="mono">{showRefund.id}</b> — {peso(showRefund.amount)} paid by {showRefund.member}.</p>
          <Field label="Reason"><textarea className="form-control" rows="3" placeholder="Reason for refund…" value={reason} onChange={e=>setReason(e.target.value)} /></Field>
          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-danger" onClick={confirmRefund}>Confirm Refund</button>
            <button className="btn btn-outline" onClick={()=>setShowRefund(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {showReceipts && (
        <Modal title="Generate Receipt" onClose={()=>setShowReceipts(false)}>
          <p style={{fontSize:12.5, color:'var(--steel)', marginBottom:10}}>Pick a recent paid transaction to view/print a receipt.</p>
          {paid.length === 0 ? (
            <div style={{fontSize:13, color:'var(--steel)'}}>No paid transactions available.</div>
          ) : (
            <Table columns={['ID','Member','Amount','Method','']} rows={paid.slice(0,8)} renderRow={t=>(
              <tr key={t.id}>
                <td className="mono">{t.id}</td>
                <td>{t.member}</td>
                <td className="mono">{peso(t.amount)}</td>
                <td>{t.method}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={()=>{setViewTxn(t); setShowReceipts(false);}}>Open →</button></td>
              </tr>
            )} />
          )}
        </Modal>
      )}

      {viewTxn && (
        <Modal title="Receipt" onClose={()=>setViewTxn(null)}>
          <div className="receipt">
            <div style={{textAlign:'center', fontFamily:'var(--font-display)', fontSize:15}}>🏋 VINATHLETICS GYM</div>
            <div style={{textAlign:'center', fontSize:10.5, color:'var(--steel)'}}>Official Receipt · {viewTxn.id}</div>
            <hr/>
            <div className="row"><span>{viewTxn.type}</span><span>{peso(viewTxn.amount)}</span></div>
            <div className="row"><span>Member</span><span>{viewTxn.member}</span></div>
            <div className="row"><span>Method</span><span>{viewTxn.method}</span></div>
            <div className="row"><span>Date</span><span>{viewTxn.date}</span></div>
            <hr/>
            <div className="row" style={{fontWeight:700}}><span>TOTAL</span><span>{peso(viewTxn.amount)}</span></div>
          </div>
          <button className="btn btn-outline btn-sm btn-block" style={{marginTop:14}} onClick={()=>{window.print(); toast('Print dialog opened');}}>Download PDF</button>
        </Modal>
      )}
    </>
  );
}

export default AdminPayments;