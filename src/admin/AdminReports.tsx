// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, BarChart, Donut, Field, Select } from '../shared';
import { downloadCSV } from '../shared/utils/csv.ts';
import { REVENUE_TREND, REVENUE_SOURCE } from '../data.ts';

function AdminReports({ members, transactions, today, toast }){
  const [dateRange, setDateRange] = useState('Last 7 Days');
  const [category, setCategory] = useState('All');
  const [branch, setBranch] = useState('Main Branch');
  const [applied, setApplied] = useState(null);

  const exportCsv = () => {
    const rows = [
      ['Report — VinAthletics Gym'],
      ['Generated', today],
      ['Filters', applied ? `${applied.dateRange} · ${applied.category} · ${applied.branch}` : 'None'],
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
    setApplied({dateRange, category, branch});
    toast('Filters applied — ' + dateRange + ' · ' + category + ' · ' + branch);
  };

  return (
    <>
      <div className="grid grid-2" style={{marginBottom:18}}>
        <TabbedCard label="Trends" title="Revenue Trend — Last 6 Months">
          <BarChart data={REVENUE_TREND} valueKey="v" labelKey="m" prefix="₱" />
        </TabbedCard>
        <TabbedCard label="Breakdown" title="Revenue by Source">
          <Donut data={REVENUE_SOURCE} />
        </TabbedCard>
      </div>
      <div className="grid grid-2-1">
        <TabbedCard label="Filter" title="Filter Reports">
          <div className="grid grid-3">
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
            <Field label="Branch">
              <Select value={branch} onChange={setBranch}>
                <option>Main Branch</option><option>Downtown</option><option>BGC</option>
              </Select>
            </Field>
          </div>
          {applied && <div style={{fontSize:11.5, color:'var(--steel)', marginBottom:10}}>Applied: <span className="mono">{applied.dateRange} · {applied.category} · {applied.branch}</span></div>}
          <button className="btn btn-signal btn-sm" onClick={apply}>Apply Filters</button>
        </TabbedCard>
        <TabbedCard label="Export" title="Export Reports">
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