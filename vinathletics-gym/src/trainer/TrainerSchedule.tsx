// @ts-nocheck
import { TabbedCard, Table } from '../shared';

function TrainerSchedule({ sessions }) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat'];
  const byDay = (d) => sessions.filter(s => (s.day||'').startsWith(d));
  return (
    <TabbedCard label="Schedule" title="Weekly View">
      <div className="grid grid-3">
        {days.map(d=>(
          <div key={d} className="card" style={{border:'1.5px solid var(--line)'}}>
            <div style={{fontFamily:'var(--font-display)', fontSize:14, marginBottom:6}}>{d}</div>
            <div style={{fontSize:11.5, color:'var(--steel)'}}>
              {byDay(d).length === 0 ? <em>No sessions</em> : byDay(d).map(s=>(<div key={s.id} className="mono">{s.time} · {s.member}</div>))}
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop:14}}>
        <Table columns={['Day','Time','Member','Type','Status']} rows={sessions} renderRow={s=>(
          <tr key={s.id}>
            <td>{s.day}</td><td className="mono">{s.time}</td><td>{s.member}</td><td>{s.type}</td><td>{s.status}</td>
          </tr>
        )} />
      </div>
    </TabbedCard>
  );
}

export default TrainerSchedule;