// @ts-nocheck
import { Badge, TabbedCard, Table } from '../shared';

function AdminCoaching({ sessions }){
  return (
    <TabbedCard label="Reports" title="Coaching Sessions Overview">
      <Table columns={['ID','Member','Trainer','Date','Time','Type','Status']} rows={sessions} renderRow={s=>(
        <tr key={s.id}>
          <td className="mono">{s.id}</td><td>{s.member}</td><td>{s.trainer}</td>
          <td className="mono">{s.date}</td><td className="mono">{s.time}</td><td>{s.type}</td>
          <td><Badge status={s.status}/></td>
        </tr>
      )} />
    </TabbedCard>
  );
}

export default AdminCoaching;