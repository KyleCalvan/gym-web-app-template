// @ts-nocheck
import { TabbedCard } from '../shared';

function StaffSchedules({ trainers }) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat'];
  return (
    <TabbedCard label="Ops" title="Weekly Trainer Schedule (View Only)">
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Trainer</th>{days.map(d=><th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {trainers.map(t=>(
              <tr key={t.id}>
                <td>{t.name}<div className="mono" style={{fontSize:10.5, color:'var(--steel)'}}>{t.specialty}</div></td>
                {days.map((d,i)=><td key={i} className="mono" style={{fontSize:11.5}}>{(i+t.id.length)%3===0 ? '—' : '6-9AM, 4-8PM'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TabbedCard>
  );
}

export default StaffSchedules;
