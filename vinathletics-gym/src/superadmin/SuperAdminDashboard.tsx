// @ts-nocheck
import { StatTile, TabbedCard, Table } from '../shared';

function SuperAdminDashboard({
  members, trainers, staff, admins,
  auditLog, activeSessions, today, onNav,
}) {
  const recent = auditLog.slice(0, 6);
  const liveSessions = activeSessions.length;

  const liveMembers  = members.filter((m) => !m.deletedAt).length;
  const liveTrainers = trainers.filter((t) => !t.deletedAt).length;
  const liveStaff    = staff.filter((s) => !s.deletedAt).length;
  const liveAdmins   = admins.filter((a) => !a.deletedAt).length;

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatTile label="Total Members" value={liveMembers} tone="court" />
        <StatTile label="Trainers" value={liveTrainers} tone="steel" />
        <StatTile label="Staff" value={liveStaff} tone="amber" />
        <StatTile label="Admin Users" value={liveAdmins} tone="signal" />
      </div>

      <TabbedCard label="System" title="Super Admin Overview">
        <p style={{ fontSize: 13, color: 'var(--steel)', margin: '0 0 14px' }}>
          Today is <b>{today}</b>. You have <b>{liveSessions}</b> active session{liveSessions === 1 ? '' : 's'} and <b>{auditLog.length}</b> log entries on file.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-signal btn-sm" onClick={() => onNav('users')}>Manage Users</button>
          <button className="btn btn-outline btn-sm" onClick={() => onNav('system_logs')}>View Audit Log</button>
          <button className="btn btn-outline btn-sm" onClick={() => onNav('trash')}>Open Trash</button>
          <button className="btn btn-outline btn-sm" onClick={() => onNav('backups')}>Download Backup</button>
          <button className="btn btn-outline btn-sm" onClick={() => onNav('sessions')}>Active Sessions</button>
        </div>
      </TabbedCard>

      <div style={{ height: 18 }}></div>

      <TabbedCard label="System" title="Recent Activity">
        {recent.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--steel)' }}>No log entries yet.</div>
        ) : (
          <Table
            columns={['Level', 'Actor', 'Action', 'Details', 'When']}
            rows={recent}
            renderRow={(l) => (
              <tr key={l.id}>
                <td>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      textTransform: 'uppercase',
                      color:
                        l.level === 'error'
                          ? 'var(--amber)'
                          : l.level === 'warn'
                          ? 'var(--court)'
                          : 'var(--steel)',
                      fontWeight: 700,
                    }}
                  >
                    {l.level}
                  </span>
                </td>
                <td>
                  {l.actor} <span className="mono" style={{ fontSize: 10.5, color: 'var(--steel)' }}>· {l.actorRole}</span>
                </td>
                <td>{l.action}</td>
                <td style={{ color: 'var(--steel)' }}>{l.details || '—'}</td>
                <td className="mono">{new Date(l.at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            )}
          />
        )}
      </TabbedCard>
    </>
  );
}

export default SuperAdminDashboard;
