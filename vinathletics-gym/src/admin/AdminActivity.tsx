// @ts-nocheck
import { TabbedCard, Table } from '../shared';

function AdminActivity(){
  const logs = [
    {who:'Admin User', action:'Registered new member Bea Fernandez', time:'Aug 19, 2026 · 10:42 AM'},
    {who:'Liza Manalo', action:'Processed POS sale TXN-8820', time:'Aug 19, 2026 · 9:15 AM'},
    {who:'James Reyes', action:'Updated availability for next week', time:'Aug 18, 2026 · 6:30 PM'},
    {who:'Admin User', action:'Refunded transaction TXN-8816', time:'Aug 18, 2026 · 3:02 PM'},
    {who:'System', action:'Auto-flagged 3 memberships expiring in 7 days', time:'Aug 18, 2026 · 12:00 AM'},
  ];
  return (
    <TabbedCard label="Reports" title="Activity Logs">
      <Table columns={['User','Action','Timestamp']} rows={logs} renderRow={(l,i)=>(
        <tr key={i}><td>{l.who}</td><td>{l.action}</td><td className="mono">{l.time}</td></tr>
      )} />
    </TabbedCard>
  );
}

export default AdminActivity;