// @ts-nocheck
import { useState } from 'react';
import { Badge, Table, TabbedCard, Modal } from '../shared';
import { peso } from '../data.ts';

function MemberPayments({ transactions, members, currentUserId, toast }){
  const [receipt, setReceipt] = useState(null);
  const me = members.find(m => m.id === currentUserId) || members[0];
  const mine = me ? transactions.filter(t => t.member === me.name) : transactions;

  return (
    <>
      <TabbedCard label="Finance" title="My Payment History">
        {mine.length === 0 ? (
          <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>No payments yet. Your membership renewals and bookings will appear here.</div>
        ) : (
          <Table columns={['ID','Type','Amount','Method','Date','Status','']} rows={mine} renderRow={t=>(
            <tr key={t.id}>
              <td className="mono">{t.id}</td><td>{t.type}</td><td className="mono">{peso(t.amount)}</td><td>{t.method}</td><td className="mono">{t.date}</td>
              <td><Badge status={t.status}/></td>
              <td><button className="btn btn-ghost btn-sm" onClick={()=>setReceipt(t)}>View Receipt</button></td>
            </tr>
          )} />
        )}
      </TabbedCard>

      {receipt && (
        <Modal title="Receipt" onClose={()=>setReceipt(null)}>
          <div className="receipt">
            <div style={{textAlign:'center', fontFamily:'var(--font-display)', fontSize:15}}>🏋 VINATHLETICS GYM</div>
            <div style={{textAlign:'center', fontSize:10.5, color:'var(--steel)'}}>Official Receipt · {receipt.id}</div>
            <hr/>
            <div className="row"><span>{receipt.type}</span><span>{peso(receipt.amount)}</span></div>
            <div className="row"><span>Method</span><span>{receipt.method}</span></div>
            <div className="row"><span>Date</span><span>{receipt.date}</span></div>
            <hr/>
            <div className="row" style={{fontWeight:700}}><span>TOTAL</span><span>{peso(receipt.amount)}</span></div>
          </div>
          <button className="btn btn-outline btn-sm btn-block" style={{marginTop:14}} onClick={()=>{window.print(); toast('Print dialog opened');}}>Download PDF</button>
        </Modal>
      )}
    </>
  );
}

export default MemberPayments;