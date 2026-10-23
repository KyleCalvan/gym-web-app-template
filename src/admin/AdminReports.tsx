// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, BarChart, Donut, Field, Select } from '../shared';
import { downloadCSV } from '../shared/utils/csv.ts';

/** Normalises any wire date (ISO timestamp or YYYY-MM-DD) to a YYYY-MM-DD key. */
function dayKey(value){
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function AdminReports({ members, transactions, today, toast }){
  const [dateRange, setDateRange] = useState('Last 7 Days');
  const [category, setCategory] = useState('All');
  const [applied, setApplied] = useState(null);

  // Both charts are computed from the live transaction rows rather than mocks.
  const paidTransactions = transactions.filter(t=>t.status==='Paid');
  const revenueTrend = Array.from({length:6}, (_, index) => {
    const month = new Date();
    month.setHours(0,0,0,0);
    month.setDate(1);
    month.setMonth(month.getMonth() - (5 - index));
    const key = dayKey(month.toISOString()).slice(0,7);
    return {
      m: month.toLocaleDateString('en-US', {month:'short'}),
      v: paidTransactions.filter(t=>dayKey(t.date).slice(0,7)===key).reduce((sum,t)=>sum+t.amount,0),
    };
  });
  const revenueTrendTotal = revenueTrend.reduce((sum,d)=>sum+d.v,0);

  const sourceColors = ['var(--court)', 'var(--signal)', 'var(--amber)', 'var(--steel)'];
  const revenueSource = Object.entries(
    paidTransactions.reduce((acc,t)=>{
      const key = t.type || 'Other';
      acc[key] = (acc[key] || 0) + t.amount;
      return acc;
    }, {})
  ).map(([l,v], index) => ({ l, v, color: sourceColors[index % sourceColors.length] }));

  const exportCsv = () => {
    const rows = [
      ['Report — VinAthletics Gym'],
      ['Generated', today],
      ['Filters', applied ? `${applied.dateRange} · ${applied.category}` : 'None'],
      [],
      ['Members'], ['ID','Name','Plan','Status','Joined'],
      ...members.filter(m => !m.deletedAt).map(m => [m.id, m.name, m.plan, m.status, m.joined]),
      [],
      ['Transactions'], ['ID','Member','Type','Amount','Method','Date','Status'],
      ...transactions.map(t => [t.id, t.member, t.type, t.amount, t.method, t.date, t.status]),
    ];
    downloadCSV('vinathletics-report-' + today.replace(/[ ,]/g,'-') + '.csv', rows);
    toast('Report exported as CSV');
  };
  const exportPdf = () => {
    toast('Print dialog opened for PDF export');
    setTimeout(()=>window.print(), 80);
  };
  const apply = () => {
    setApplied({dateRange, category});
    toast('Filters applied — ' + dateRange + ' · ' + category);
  };

  return (
    <>
      <div className="grid grid-2" style={{marginBottom:18}}>
        <TabbedCard title="Revenue Trend — Last 6 Months">
          {revenueTrendTotal > 0
            ? <BarChart data={revenueTrend} valueKey="v" labelKey="m" prefix="₱" />
            : <div style={{fontSize:13.8, color:'var(--steel)', padding:'8px 0'}}>No paid transactions in the last 6 months.</div>}
        </TabbedCard>
        <TabbedCard title="Revenue by Source">
          {revenueSource.length > 0
            ? <Donut data={revenueSource} />
            : <div style={{fontSize:13.8, color:'var(--steel)', padding:'8px 0'}}>No paid transactions yet.</div>}
        </TabbedCard>
      </div>
      <div className="grid grid-2-1">
        <TabbedCard title="Filter Reports">
          <div className="grid grid-2">
            <Field label="Date Range">
              <Select value={dateRange} onChange={setDateRange}>
                <option>Last 7 Days</option><option>Last 30 Days</option><option>Last 6 Months</option>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={category} onChange={setCategory}>
                <option>All</option><option>Memberships</option><option>PT Sessions</option><option>POS</option>
              </Select>
            </Field>
          </div>
          {applied && <div style={{fontSize:12.7, color:'var(--steel)', marginBottom:10}}>Applied: <span className="mono">{applied.dateRange} · {applied.category}</span></div>}
          <button className="btn btn-signal btn-sm" onClick={apply}>Apply Filters</button>
        </TabbedCard>
        <TabbedCard title="Export Reports">
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            <button className="btn btn-outline btn-block" onClick={exportCsv}>Export as CSV</button>
            <button className="btn btn-outline btn-block" onClick={exportPdf}>Export as PDF</button>
          </div>
        </TabbedCard>
      </div>
    </>
  );
}

export default AdminReports;