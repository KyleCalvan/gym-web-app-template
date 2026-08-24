// @ts-nocheck
import { StatTile, TabbedCard, Table } from '../shared';

function TrainerDashboard({ sessions }) {
  const today = sessions.filter(s => s.day === 'Today' || s.day === new Date().toLocaleDateString('en-US',{weekday:'long'}));
  const booked = sessions.filter(s => s.status === 'Booked').length;
  const attended = sessions.filter(s => s.status === 'Attended').length;
  return (
    <>
      <div className="grid grid-3" style={{marginBottom:18}}>
        <StatTile label="Today's Sessions" value={today.length} tone="court"/>
        <StatTile label="Booked (Week)" value={booked} tone="amber"/>
        <StatTile label="Attended (Month)" value={attended} tone="steel"/>
      </div>
      <TabbedCard label="Today" title="Upcoming Sessions">
        <Table columns={['Member','Type','Time','Status']} rows={today} renderRow={s=>(
          <tr key={s.id}><td>{s.member}</td><td>{s.type}</td><td className="mono">{s.time}</td><td>{s.status}</td></tr>
        )} />
      </TabbedCard>
    </>
  );
}

export default TrainerDashboard;