// @ts-nocheck
import { useState, useMemo } from 'react';
import { Table, Modal, Field, Select, TextInput, TabbedCard } from '../shared';

function SuperAdminSystemLogs({ auditLog, setAuditLog, addAudit, toast }) {
  const [levelF, setLevelF] = useState('all');
  const [roleF, setRoleF] = useState('all');
  const [q, setQ] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => {
    return auditLog
      .filter((l) => levelF === 'all' || l.level === levelF)
      .filter((l) => roleF === 'all' || l.actorRole === roleF)
      .filter((l) => {
        if (!q.trim()) return true;
        const needle = q.toLowerCase();
        return (
          l.actor.toLowerCase().includes(needle) ||
          l.action.toLowerCase().includes(needle) ||
          (l.details || '').toLowerCase().includes(needle)
        );
      })
      .slice()
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [auditLog, levelF, roleF, q]);

  const counts = {
    info:  auditLog.filter((l) => l.level === 'info').length,
    warn:  auditLog.filter((l) => l.level === 'warn').length,
    error: auditLog.filter((l) => l.level === 'error').length,
  };

  const applyClear = () => {
    setAuditLog([]);
    setConfirmClear(false);
    toast('Audit log cleared');
    // Log entry about the clear is intentionally skipped (log is empty by the time it's added).
  };

  const fmt = (iso) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="stat-tile"><div className="eyebrow">Total Entries</div><div className="num">{auditLog.length}</div></div>
        <div className="stat-tile"><div className="eyebrow">Info</div><div className="num">{counts.info}</div></div>
        <div className="stat-tile"><div className="eyebrow">Warning</div><div className="num">{counts.warn}</div></div>
        <div className="stat-tile"><div className="eyebrow">Errors</div><div className="num">{counts.error}</div></div>
      </div>

      <TabbedCard
        label="System"
        title="System Logs"
        right={<button className="btn btn-outline btn-sm" onClick={() => setConfirmClear(true)}>Clear Logs</button>}
      >
        <div className="search-row">
          <TextInput placeholder="Search by actor, action, or details…" value={q} onChange={setQ} />
          <Select value={levelF} onChange={setLevelF} style={{ maxWidth: 130 }}>
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </Select>
          <Select value={roleF} onChange={setRoleF} style={{ maxWidth: 160 }}>
            <option value="all">All Roles</option>
            <option value="superadmin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="trainer">Trainer</option>
            <option value="member">Member</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--steel)', padding: '14px 0' }}>
            No log entries match these filters.
          </div>
        ) : (
          <Table
            columns={['Level', 'Actor', 'Action', 'Details', 'When']}
            rows={filtered}
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
                <td className="mono">{fmt(l.at)}</td>
              </tr>
            )}
          />
        )}
      </TabbedCard>

      {confirmClear && (
        <Modal title="Clear All Logs?" showCloseButton={false} onClose={() => setConfirmClear(false)}>
          <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 14 }}>
            You're about to clear all <b>{auditLog.length}</b> log entries. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setConfirmClear(false)}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={applyClear}>Clear All</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default SuperAdminSystemLogs;
