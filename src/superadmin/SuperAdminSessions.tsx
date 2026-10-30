// @ts-nocheck
import { useState, useMemo } from 'react';
import { Table, Modal, Badge, TabbedCard, StatTile } from '../shared';

const fmt = (iso) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

function SuperAdminSessions({ activeSessions, currentSessionId, toast, onSuperAdminAction }) {
  const [pendingTerminate, setPendingTerminate] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const others = useMemo(() => activeSessions.filter((s) => s.id !== currentSessionId), [activeSessions, currentSessionId]);
  const me = activeSessions.find((s) => s.id === currentSessionId);

  const roleTone = (r) => (
    r === 'superadmin' ? 'Active'
    : r === 'admin' ? 'Active'
    : r === 'staff' ? 'On Leave'
    : r === 'trainer' ? 'Active'
    : 'Active'
  );

  const terminateOne = async (s) => {
    try { await onSuperAdminAction('session.terminate', { id: s.id });
      toast(`Session terminated — ${s.userName}`); setPendingTerminate(null); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not terminate session'); }
  };

  const terminateAllOthers = async () => {
    const count = others.length;
    try { await onSuperAdminAction('session.terminate-others', {});
      toast(`Terminated ${count} other session${count === 1 ? '' : 's'}`); setConfirmAll(false); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not terminate sessions'); }
  };

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatTile label="Total Sessions" value={activeSessions.length} />
        <StatTile label="Your Session" value={me ? 'Active' : 'None'} />
        <StatTile label="Other Sessions" value={others.length} />
        <div className="stat-tile">
          <button className="btn btn-outline btn-sm" disabled={others.length === 0} onClick={() => setConfirmAll(true)}>
            Terminate All Others
          </button>
        </div>
      </div>

      <TabbedCard title="Active Sessions">
        {activeSessions.length === 0 ? (
          <div style={{ fontSize: 14.3, color: 'var(--steel)', padding: '14px 0' }}>
            No active sessions right now.
          </div>
        ) : (
          <Table
            columns={['User','Role','Logged In','Last Active','']}
            rows={activeSessions}
            renderRow={(s) => {
              const isMe = s.id === currentSessionId;
              return (
                <tr key={s.id}>
                  <td>
                    <b>{s.userName}</b>
                    {isMe && <span className="mono" style={{ fontSize: 11.6, color:'var(--signal-ink)', marginLeft: 6 }}>(you)</span>}
                    <div className="mono" style={{ fontSize: 11.6, color: 'var(--steel)' }}>{s.userId}</div>
                  </td>
                  <td><Badge status={roleTone(s.role)} /> <span style={{ marginLeft: 6, textTransform: 'capitalize', fontSize: 13.2 }}>{s.role}</span></td>
                  <td className="mono">{fmt(s.loginAt)}</td>
                  <td className="mono">{fmt(s.lastActiveAt)}</td>
                  <td>
                    {isMe ? (
                      <span style={{ fontSize: 12.7, color: 'var(--steel)' }}>Current session</span>
                    ) : (
                      <button className="btn btn-danger btn-sm" onClick={() => setPendingTerminate(s)}>Terminate</button>
                    )}
                  </td>
                </tr>
              );
            }}
          />
        )}
      </TabbedCard>

      {pendingTerminate && (
        <Modal title="Terminate Session?" onClose={() => setPendingTerminate(null)}>
          <p style={{ fontSize: 14.3, color: 'var(--steel)', marginBottom: 14 }}>
            You're about to terminate <b>{pendingTerminate.userName}</b>'s session ({pendingTerminate.role}). They will need to sign in again.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setPendingTerminate(null)}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={() => void terminateOne(pendingTerminate)}>Terminate</button>
          </div>
        </Modal>
      )}

      {confirmAll && (
        <Modal title="Terminate All Other Sessions?" onClose={() => setConfirmAll(false)}>
          <p style={{ fontSize: 14.3, color: 'var(--steel)', marginBottom: 14 }}>
            This will terminate <b>{others.length}</b> other active session{others.length === 1 ? '' : 's'}. Users will be forced to sign in again. Your session will be preserved.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setConfirmAll(false)}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={() => void terminateAllOthers()}>Terminate All</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default SuperAdminSessions;
