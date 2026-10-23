// @ts-nocheck
import { StatTile, Badge, BarChart, Donut, Table, TabbedCard } from '../shared';
import { downloadCSV } from '../shared/utils/csv.ts';
import { peso } from '../data.ts';

/** Normalises any wire date (ISO timestamp or YYYY-MM-DD) to a YYYY-MM-DD key. */
function dayKey(value){
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function AdminDashboard({ onNav, members, trainers, transactions, sessions, promotions, today, toast }){
  const published = promotions.filter(p=>p.status==='Published');
  const liveMembers = members.filter(m => !m.deletedAt);
  const liveTrainers = trainers.filter(t => !t.deletedAt);
  const totalMembers = liveMembers.length;
  const activeCount = liveMembers.filter(m=>m.status==='Active').length;
  const paid = transactions.filter(t=>t.status==='Paid');
  const revenueMtd = paid.reduce((a,t)=>a+t.amount,0);
  const activeTrainers = liveTrainers.filter(t=>t.status==='Active').length;
  const today2 = new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
  const todayKey = dayKey(new Date().toISOString());
  const sessionsToday = sessions.filter(s=>dayKey(s.date)===todayKey).length;

  // Derived from live transactions, not mocks — the last 7 calendar days of paid revenue.
  const revenue7d = Array.from({length:7}, (_, index) => {
    const day = new Date();
    day.setHours(0,0,0,0);
    day.setDate(day.getDate() - (6 - index));
    const key = dayKey(day.toISOString());
    return {
      d: day.toLocaleDateString('en-US', {month:'short', day:'2-digit'}),
      v: paid.filter(t=>dayKey(t.date)===key).reduce((sum,t)=>sum+t.amount,0),
    };
  });
  const revenue7dTotal = revenue7d.reduce((sum,d)=>sum+d.v,0);

  // Membership distribution straight off the live member rows.
  const membershipDist = [
    { l: 'Active', color: 'var(--court)' },
    { l: 'Expiring', color: 'var(--amber)' },
    { l: 'Frozen', color: 'var(--steel)' },
    { l: 'Expired', color: 'var(--signal)' },
  ].map(({ l, color }) => ({
    l,
    color,
    v: liveMembers.filter(m=>m.status===l).length,
  })).filter(d=>d.v>0);

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
        <StatTile label="Total Members" value={totalMembers} delta={`${activeCount} active`} />
        <StatTile label="Revenue (MTD)" value={peso(revenueMtd)} delta={`${paid.length} paid txns`} tone="court" />
        <StatTile label="Active Trainers" value={activeTrainers} delta={`${liveTrainers.length-activeTrainers} on leave/inactive`} tone="amber" />
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
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            <button className="btn btn-signal btn-block" onClick={()=>onNav && onNav('members')}>+ Register Member</button>
            <button className="btn btn-outline btn-block" onClick={()=>onNav && onNav('trainers')}>+ Add Trainer</button>
            <button className="btn btn-outline btn-block" onClick={()=>onNav && onNav('promotions')}>Create Promotion</button>
            <button className="btn btn-outline btn-block" onClick={exportReport}>Export Report</button>
          </div>
        </TabbedCard>
      </div>

      <div className="grid grid-2" style={{marginBottom:18}}>
        <TabbedCard title="Revenue — Last 7 Days">
          {revenue7dTotal > 0
            ? <BarChart data={revenue7d} valueKey="v" labelKey="d" prefix="₱" />
            : <div style={{fontSize:13.8, color:'var(--steel)', padding:'8px 0'}}>No paid transactions in the last 7 days.</div>}
        </TabbedCard>
        <TabbedCard title="Membership Distribution">
          {membershipDist.length > 0
            ? <Donut data={membershipDist} />
            : <div style={{fontSize:13.8, color:'var(--steel)', padding:'8px 0'}}>No members yet.</div>}
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