// @ts-nocheck
import { useState, useMemo } from 'react';
import { Table, Modal, Badge, TabbedCard } from '../shared';

const fmt = (iso) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

function SuperAdminSessions({ activeSessions, setActiveSessions, currentSessionId, toast, addAudit }) {
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

  const terminateOne = (s) => {
    setActiveSessions((prev) => prev.filter((x) => x.id !== s.id));
    addAudit?.('warn', 'Session terminated', `${s.userName} (${s.role})`);
    toast(`Session terminated — ${s.userName}`);
    setPendingTerminate(null);
  };

  const terminateAllOthers = () => {
    const count = others.length;
    setActiveSessions((prev) => prev.filter((x) => x.id === currentSessionId || !x.id));
    addAudit?.('warn', 'Bulk session termination', `${count} other session(s) terminated`);
    toast(`Terminated ${count} other session${count === 1 ? '' : 's'}`);
    setConfirmAll(false);
  };

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="stat-tile"><div className="eyebrow">Total Sessions</div><div className="num">{activeSessions.length}</div></div>
        <div className="stat-tile"><div className="eyebrow">Your Session</div><div className="num" style={{ fontSize: 16 }}>{me ? 'Active' : 'None'}</div></div>
        <div className="stat-tile"><div className="eyebrow">Other Sessions</div><div className="num">{others.length}</div></div>
        <div className="stat-tile">
          <button className="btn btn-outline btn-sm" disabled={others.length === 0} onClick={() => setConfirmAll(true)}>
            Terminate All Others
          </button>
        </div>
      </div>

      <TabbedCard label="Maintenance" title="Active Sessions">
        {activeSessions.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--steel)', padding: '14px 0' }}>
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
                    {isMe && <span className="mono" style={{ fontSize: 10.5, color: 'var(--signal)', marginLeft: 6 }}>(you)</span>}
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--steel)' }}>{s.userId}</div>
                  </td>
                  <td><Badge status={roleTone(s.role)} /> <span style={{ marginLeft: 6, textTransform: 'capitalize', fontSize: 12 }}>{s.role}</span></td>
                  <td className="mono">{fmt(s.loginAt)}</td>
                  <td className="mono">{fmt(s.lastActiveAt)}</td>
                  <td>
                    {isMe ? (
                      <span style={{ fontSize: 11.5, color: 'var(--steel)' }}>Current session</span>
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
          <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 14 }}>
            You're about to terminate <b>{pendingTerminate.userName}</b>'s session ({pendingTerminate.role}). They will need to sign in again.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setPendingTerminate(null)}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={() => terminateOne(pendingTerminate)}>Terminate</button>
          </div>
        </Modal>
      )}

      {confirmAll && (
        <Modal title="Terminate All Other Sessions?" onClose={() => setConfirmAll(false)}>
          <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 14 }}>
            This will terminate <b>{others.length}</b> other active session{others.length === 1 ? '' : 's'}. Users will be forced to sign in again. Your session will be preserved.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setConfirmAll(false)}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={terminateAllOthers}>Terminate All</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default SuperAdminSessions;
