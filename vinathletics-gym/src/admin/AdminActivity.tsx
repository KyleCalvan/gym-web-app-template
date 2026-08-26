// @ts-nocheck
import { TabbedCard, Table } from '../shared';

function AdminActivity(){
  const logs = [];
  return (
    <TabbedCard label="Reports" title="Activity Logs">
      {logs.length === 0 ? <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>No activity yet.</div> : (
        <Table columns={['User','Action','Timestamp']} rows={logs} renderRow={(l,i)=>(
          <tr key={i}><td>{l.who}</td><td>{l.action}</td><td className="mono">{l.time}</td></tr>
        )} />
      )}
    </TabbedCard>
  );
}

export default AdminActivity;