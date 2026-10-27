// @ts-nocheck
import { StatTile, Badge, BarChart, Donut, Table, TabbedCard } from '../shared';
import { downloadCSV } from '../shared/utils/csv.ts';
import { peso } from '../data.ts';

function AdminDashboard({ onNav, members, trainers, transactions, sessions, promotions, today, toast }){
  const published = promotions.filter(p=>p.status==='Published');
  const liveMembers = members.filter(m => !m.deletedAt);
  const liveTrainers = trainers.filter(t => !t.deletedAt);
  const membershipCounts = new Map();
  liveMembers.forEach(member => membershipCounts.set(member.plan || 'No plan', (membershipCounts.get(member.plan || 'No plan') || 0) + 1));
  const planColors = { premium: 'var(--signal-ink)', elite: 'var(--amber)', basic: 'var(--chart-blue)' };
  const distribution = Array.from(membershipCounts, ([l, v], index) => ({ l, v, color: planColors[l.toLowerCase()] || ['var(--signal-ink)', 'var(--amber)', 'var(--chart-blue)', 'var(--danger)'][index % 4] }));
  const activeCount = liveMembers.filter(m=>m.status==='Active').length;
  const paid = transactions.filter(t=>t.status==='Paid');
  const revenueMtd = paid.filter(t => {
    const date = new Date(t.date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).reduce((a,t)=>a+t.amount,0);
  const activeTrainers = liveTrainers.filter(t=>t.status==='Active').length;
  const today2 = new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
  const sessionsToday = sessions.filter(s=>s.date===today2).length;
  const revenue7d = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dateKey = date.toDateString();
    return { d: date.toLocaleDateString('en-US', { weekday: 'short' }),
      v: paid.filter(t => new Date(t.date).toDateString() === dateKey).reduce((sum, t) => sum + t.amount, 0) };
  });

  const exportReport = () => {
    const rows = [
      ['Members'],
      ['ID','Name','Email','Phone','Plan','Status','Joined'],
      ...liveMembers.map(m => [m.id, m.name, m.email, m.phone, m.plan, m.status, m.joined]),
      [],
      ['Transactions'],
      ['ID','Member','Type','Amount','Method','Date','Status'],
      ...transactions.map(t => [t.id, t.member, t.type, t.amount, t.method, t.date, t.status]),
      [],
      ['Sessions'],
      ['ID','Member','Trainer','Date','Time','Type','Status'],
      ...sessions.map(s => [s.id, s.member, s.trainer, s.date, s.time, s.type, s.status]),
    ];
    downloadCSV('vinathletics-report-' + today2.replace(/[ ,]/g,'-') + '.csv', rows);
    toast('Report exported as CSV');
  };

  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Revenue (MTD)" value={peso(revenueMtd)} delta={`${paid.length} paid txns`} tone="court" />
        <StatTile label="Active Members" value={activeCount} delta={`${liveMembers.length-activeCount} inactive or paused`} tone="attention" />
        <StatTile label="Active Trainers" value={activeTrainers} delta={`${liveTrainers.length-activeTrainers} on leave/inactive`} tone="attention" />
        <StatTile label="Sessions Today" value={sessionsToday} delta={`${sessions.filter(s=>s.status==='Pending').length} pending`} tone="steel" />
      </div>

      <div className="grid grid-2-1" style={{marginBottom:18, alignItems:'start'}}>
        <TabbedCard title="Recent Transactions" right={<button className="btn btn-outline btn-sm" onClick={()=>onNav && onNav('payments')}>View All</button>}>
          <Table columns={['ID','Member','Type','Amount','Status']} rows={transactions.slice(0,5)} renderRow={t=>(
            <tr key={t.id}>
              <td className="mono">{t.id}</td>
              <td>{t.member}</td>
              <td>{t.type}</td>
              <td className="mono">{peso(t.amount)}</td>
              <td><Badge status={t.status} /></td>
            </tr>
          )} />
        </TabbedCard>

        <TabbedCard title="Quick Actions">
          <div className="manager-quick-actions">
            <button className="btn btn-signal btn-block" onClick={()=>onNav && onNav('members', 'register-member')}>+ Register Member</button>
            <button className="btn btn-outline btn-block" onClick={()=>onNav && onNav('trainers', 'add-trainer')}>+ Add Trainer</button>
            <button className="btn btn-outline btn-block" onClick={()=>onNav && onNav('promotions', 'create-promotion')}>Create Promotion</button>
            <button className="btn btn-outline" onClick={()=>onNav && onNav('trainers', 'add-staff')}>+ Add Staff</button>
            <button className="btn btn-outline btn-block" onClick={exportReport}>Export Report</button>
          </div>
        </TabbedCard>
      </div>

      <div className="grid grid-2" style={{marginBottom:18, alignItems:'start'}}>
        <TabbedCard title="Revenue — Last 7 Days">
          <BarChart data={revenue7d} valueKey="v" labelKey="d" prefix="₱" />
        </TabbedCard>
        <TabbedCard title="Membership Distribution">
          <Donut data={distribution} size={132} />
        </TabbedCard>
      </div>

      <TabbedCard
        title="Promotional Management"
        right={<button className="btn btn-signal btn-sm" onClick={()=>onNav && onNav('promotions')}>+ Create Promotion</button>}
      >
        {published.length === 0 ? (
          <div style={{fontSize:13.8, color:'var(--steel)', padding:'8px 0'}}>No active promotions. Create or publish one to see it here.</div>
        ) : published.map(p=>(
          <div className="promo-widget-row" key={p.id}>
            <div>
              <b>{p.title}</b>
              <div className="mono" style={{fontSize:12.1, color:'var(--steel)'}}>{p.code} · {p.discount} · valid thru {p.validUntil}</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <span className="mono" style={{fontSize:13.2, color:'var(--steel)'}}>{p.redemptions}/{p.maxRedemptions} redeemed</span>
              <Badge status={p.status}/>
            </div>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{marginTop:10}} onClick={()=>onNav && onNav('promotions')}>Manage all promotions →</button>
      </TabbedCard>
    </>
  );
}

export default AdminDashboard;
