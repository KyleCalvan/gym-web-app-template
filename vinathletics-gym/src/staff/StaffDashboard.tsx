// @ts-nocheck
import { StatTile, TabbedCard, Table, Badge } from '../shared';
import { peso } from '../data.ts';

function StaffDashboard({ checkIns, members, transactions }) {
  const todayRevenue = transactions.filter(t => t.date === new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'}) && t.status==='Paid').reduce((a,t)=>a+t.amount,0);
  const newThisMonth = members.filter(m => {
    const d = new Date(m.joined);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const expiring = members.filter(m => m.status === 'Expiring').length;
  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Check-ins Today" value={checkIns.count} tone="court"/>
        <StatTile label="New Sign-ups" value={newThisMonth} tone="amber"/>
        <StatTile label="Pending Renewals" value={expiring} tone="steel"/>
        <StatTile label="Today's Revenue" value={peso(todayRevenue)}/>
      </div>
      <TabbedCard label="Finance" title="Recent Transactions">
        <Table columns={['ID','Member','Type','Amount','Status']} rows={transactions.slice(0,4)} renderRow={t=>(
          <tr key={t.id}><td className="mono">{t.id}</td><td>{t.member}</td><td>{t.type}</td><td className="mono">{peso(t.amount)}</td><td><Badge status={t.status}/></td></tr>
        )} />
      </TabbedCard>
    </>
  );
}

export default StaffDashboard;
