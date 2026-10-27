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
  toast, addAudit, readOnly = false,
}) {
  const [confirmDownload, setConfirmDownload] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreText, setRestoreText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [restoring, setRestoring] = useState(false);

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
    if (readOnly) { toast('Database backups are not yet available.'); setConfirmDownload(false); return; }
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

  const doRestore = async () => {
    if (readOnly) { toast('Database restore is not yet available.'); setConfirmRestore(false); return; }
    if (restoreText !== 'RESTORE') return;
    setRestoring(true);
    try {
      // Mock API Call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      addAudit?.('warning', 'Database Restored', 'Restored from saved backup');
      toast('Database restored successfully');
    } catch (e) {
      toast('Restore failed');
    } finally {
      setRestoring(false);
      setConfirmRestore(false);
      setRestoreText('');
    }
  };

  const doUpload = async (e) => {
    if (readOnly) { toast('Database backup upload is not yet available.'); e.target.value = ''; return; }
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        if (!text) throw new Error('Empty file');

        // Client-side JSON validation
        JSON.parse(text);

        // Mock API Call
        await new Promise((resolve) => setTimeout(resolve, 1500));
        addAudit?.('info', 'Backup Uploaded', `Uploaded ${file.name}`);
        toast('Backup uploaded successfully');
      } catch (err) {
        toast('Invalid JSON backup file');
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setUploading(false);
      toast('Error reading file');
    };
    reader.readAsText(file);
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

      <TabbedCard title="Database Backup">
        <p style={{ fontSize: 14.3, color: 'var(--steel)', margin: '0 0 14px' }}>
          {readOnly
            ? 'The record counts below come from PostgreSQL. Backup download, upload, and restore are not yet connected.'
            : 'Download a JSON snapshot of every in-memory slice. Useful before destructive changes or for offline analysis.'}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className="btn btn-signal" onClick={() => readOnly ? toast('Database backups are not yet available.') : setConfirmDownload(true)}>Download Backup</button>
          <button
            className="btn btn-signal"
            onClick={() => readOnly ? toast('Database backup upload is not yet available.') : document.getElementById('backup-upload')?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload JSON Backup'}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => readOnly ? toast('Database restore is not yet available.') : setConfirmRestore(true)}
            disabled={restoring}
          >
            {restoring ? 'Restoring...' : 'Restore from Saved Backup'}
          </button>
          <input
            id="backup-upload"
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={doUpload}
          />
          <div style={{ fontSize: 13.2, color: 'var(--steel)' }}>
            Last backup:&nbsp;
            {lastBackup
              ? <span className="mono">{new Date(lastBackup).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              : <i>never</i>}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <Table
            columns={['Slice','Records']}
            rows={Object.entries(stats)}
            renderRow={([k, v]) => (
              <tr key={k}>
                <td className="mono" style={{ textTransform: 'uppercase', fontSize: 12.1 }}>{k}</td>
                <td>{v}</td>
              </tr>
            )}
          />
        </div>
      </TabbedCard>

      {confirmDownload && (
        <Modal title="Download Backup?" showCloseButton={false} onClose={() => setConfirmDownload(false)}>
          <p style={{ fontSize: 14.3, color: 'var(--steel)', marginBottom: 14 }}>
            A <b>vinathletics-backup-{'{timestamp}'}.json</b> file will be generated and downloaded. The file reflects the current app state, including any unsaved changes in this session.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setConfirmDownload(false)}>Cancel</button>
            <button className="btn btn-signal" type="button" onClick={doDownload}>Download</button>
          </div>
        </Modal>
      )}

      {confirmRestore && (
        <Modal title="Confirm Restoration" showCloseButton={false} onClose={() => setConfirmRestore(false)}>
          <p style={{ fontSize: 14.3, color: 'var(--steel)', marginBottom: 14 }}>
            Warning: Restoring a backup will overwrite the current database state. This action cannot be undone.
            To proceed, please type <b className="mono">RESTORE</b> below.
          </p>
          <input
            className="input-text"
            style={{ width: '100%', marginBottom: 14, padding: 8, border: '1px solid var(--line)', borderRadius: 4 }}
            value={restoreText}
            onChange={(e) => setRestoreText(e.target.value)}
            placeholder="Type RESTORE to confirm"
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setConfirmRestore(false)}>Cancel</button>
            <button
              className="btn btn-danger"
              type="button"
              disabled={restoreText !== 'RESTORE'}
              onClick={doRestore}
            >
              Confirm Restore
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default SuperAdminBackups;
