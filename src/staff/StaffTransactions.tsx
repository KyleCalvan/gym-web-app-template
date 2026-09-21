// @ts-nocheck
import { useState } from 'react';
import { StatTile, TabbedCard, Table, Modal } from '../shared';
import { peso } from '../data.ts';

function StaffTransactions({ transactions }) {
  const today = new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
  const todays = transactions.filter(t => t.date === today);
  const todayTotal = todays.filter(t=>t.status==='Paid').reduce((a,t)=>a+t.amount,0);
  const refunds = transactions.filter(t => t.status==='Refunded').length;
  const [viewTxn, setViewTxn] = useState(null);

  return (
    <>
      <div className="grid grid-3" style={{marginBottom:18}}>
        <StatTile label="Transactions Today" value={todays.length}/>
        <StatTile label="Today's Sales" value={peso(todayTotal)} tone="court"/>
        <StatTile label="Refunds" value={refunds} tone="steel"/>
      </div>
      <TabbedCard label="Finance" title={"My Transactions — Today, " + today}>
        {todays.length === 0 ? (
          <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>No transactions yet today. Use the Point of Sale to record one.</div>
        ) : (
          <Table columns={['ID','Member','Type','Amount','Method','']} rows={todays} renderRow={t=>(
            <tr key={t.id}>
              <td className="mono">{t.id}</td><td>{t.member}</td><td>{t.type}</td><td className="mono">{peso(t.amount)}</td><td>{t.method}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={()=>setViewTxn(t)}>Receipt →</button></td>
            </tr>
          )} />
        )}
      </TabbedCard>

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
          <button className="btn btn-outline btn-sm btn-block" style={{marginTop:14}} onClick={()=>window.print()}>Download PDF</button>
        </Modal>
      )}
    </>
  );
}

export default StaffTransactions;
