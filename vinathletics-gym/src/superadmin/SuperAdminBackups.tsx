// @ts-nocheck
import { useState, useMemo } from 'react';
import { StatTile, TabbedCard, Table, Modal } from '../shared';

function buildSnapshot(allSlices) {
  return {
    generatedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    data: allSlices,
  };
}

const safeStamp = (iso) => iso.replace(/[:.]/g, '-');

function SuperAdminBackups({
  members, trainers, plans, transactions, sessions, promotions, staff, admins,
  notifications, bookings, checkIns, checkInHistory, auditLog, activeSessions, notifPrefs,
  toast, addAudit,
}) {
  const [confirmDownload, setConfirmDownload] = useState(false);

  const stats = useMemo(() => ({
    members: members.length, trainers: trainers.length, staff: staff.length, admins: admins.length,
    sessions: sessions.length, promotions: promotions.length, transactions: transactions.length,
    plans: plans.length, auditLog: auditLog.length, activeSessions: activeSessions.length,
  }), [members, trainers, staff, admins, sessions, promotions, transactions, plans, auditLog, activeSessions]);

  const lastBackup = useMemo(() => {
    const entry = auditLog.find((l) => l.action === 'Backup downloaded');
    return entry ? entry.at : null;
  }, [auditLog]);

  const doDownload = () => {
    const snap = buildSnapshot({
      members, trainers, plans, transactions, sessions, promotions, staff, admins,
      notifications, bookings, checkIns, checkInHistory, auditLog, activeSessions, notifPrefs,
    });
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vinathletics-backup-${safeStamp(snap.generatedAt)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setConfirmDownload(false);
    addAudit?.('info', 'Backup downloaded', `${Object.keys(snap.data).length} slices`);
    toast('Backup downloaded');
  };

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatTile label="Tables in Snapshot" value={Object.keys(stats).length} tone="court" />
        <StatTile label="Total Records" value={
          stats.members + stats.trainers + stats.staff + stats.admins + stats.sessions +
          stats.promotions + stats.transactions + stats.plans
        } />
        <StatTile label="Audit Entries" value={stats.auditLog} tone="amber" />
        <StatTile label="Active Sessions" value={stats.activeSessions} tone="signal" />
      </div>

      <TabbedCard label="Maintenance" title="Database Backup">
        <p style={{ fontSize: 13, color: 'var(--steel)', margin: '0 0 14px' }}>
          Download a JSON snapshot of every in-memory slice. Useful before destructive changes or for offline analysis.
          The file contains all members, trainers, plans, transactions, sessions, promotions, staff, admins, notifications, bookings, check-ins, audit log, and active sessions.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className="btn btn-signal" onClick={() => setConfirmDownload(true)}>Download Backup</button>
          <div style={{ fontSize: 12, color: 'var(--steel)' }}>
            Last backup:&nbsp;
            {lastBackup
              ? <span className="mono">{new Date(lastBackup).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              : <i>never</i>}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div className="eyebrow">Snapshot preview</div>
          <Table
            columns={['Slice','Records']}
            rows={Object.entries(stats)}
            renderRow={([k, v]) => (
              <tr key={k}>
                <td className="mono" style={{ textTransform: 'uppercase', fontSize: 11 }}>{k}</td>
                <td>{v}</td>
              </tr>
            )}
          />
        </div>
      </TabbedCard>

      {confirmDownload && (
        <Modal title="Download Backup?" onClose={() => setConfirmDownload(false)}>
          <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 14 }}>
            A <b>vinathletics-backup-{'{timestamp}'}.json</b> file will be generated and downloaded. The file reflects the current app state, including any unsaved changes in this session.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setConfirmDownload(false)}>Cancel</button>
            <button className="btn btn-signal" type="button" onClick={doDownload}>Download</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default SuperAdminBackups;
