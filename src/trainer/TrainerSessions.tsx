// @ts-nocheck
import { useEffect, useState } from 'react';
import { TabbedCard, Table, Badge, Modal, Field } from '../shared';
import { formatTime12h } from './availability.ts';

function formatDate(iso) {
  if (!iso) return '';
  // Try to render "Aug 20, 2026" style.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

function TrainerSessions({ sessions = [], setSessions = () => {}, toast, addAudit = () => {}, databaseMode = false }) {
  const [confirm, setConfirm] = useState<{ action: 'complete' | 'cancel'; id: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [assignedSessions, setAssignedSessions] = useState([]);
  const [loading, setLoading] = useState(databaseMode);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const rows = databaseMode ? assignedSessions : sessions;

  const loadSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/trainer/sessions', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Assigned sessions could not be loaded.');
      setAssignedSessions(data.sessions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Assigned sessions could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (databaseMode) void loadSessions(); }, [databaseMode]);

  const complete = async (id) => {
    if (databaseMode) {
      await updateSession(id, 'complete');
      return;
    }
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'Completed' } : s)));
    toast('Session marked complete');
    addAudit?.('info', 'Session completed', id);
  };

  const cancel = async (id, reason) => {
    if (databaseMode) {
      await updateSession(id, 'cancel', reason);
      return;
    }
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'Cancelled' } : s)));
    toast('Session cancelled');
    addAudit?.('warn', `Session cancelled. Reason: ${reason}`, id);
  };

  const updateSession = async (id, action, reason) => {
    setSaving(true);
    try {
      const response = await fetch('/api/trainer/sessions', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Session could not be updated.');
      setAssignedSessions(previous => previous.map(session =>
        session.id === id ? { ...session, status: data.status } : session));
      setConfirm(null);
      toast(action === 'complete' ? 'Session marked complete' : 'Session cancelled');
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Session could not be updated.');
      await loadSessions();
    } finally {
      setSaving(false);
    }
  };

  return (
    <TabbedCard title="ASSIGNED SESSIONS">
      {databaseMode && (loading ? <p role="status">Loading assigned sessions…</p>
        : error ? <p role="alert">{error} <button type="button" onClick={() => void loadSessions()}>Retry</button></p>
          : rows.length === 0 ? <p>No sessions assigned yet.</p> : null)}
      {!loading && !error && (!databaseMode || rows.length > 0) && <Table
        columns={['ID', 'MEMBER', 'DATE', 'TIME', 'TYPE', 'STATUS', '']}
        rows={rows}
        renderRow={(s) => (
          <tr key={s.id}>
            <td className="mono">{s.id}</td>
            <td>{s.member}</td>
            <td>{formatDate(s.date)}</td>
            <td className="mono">{formatTime12h(s.time)}</td>
            <td>{s.type}</td>
            <td><Badge status={s.status} /></td>
            <td>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirm({ action: 'complete', id: s.id })}
                disabled={saving || (databaseMode ? s.status !== 'Confirmed' : s.status === 'Completed' || s.status === 'Cancelled')}
              >
                Complete
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: 4, color: 'var(--danger)' }}
                onClick={() => {
                  setCancelReason('');
                  setConfirm({ action: 'cancel', id: s.id });
                }}
                disabled={saving || (databaseMode ? s.status !== 'Confirmed' : s.status === 'Completed' || s.status === 'Cancelled')}
              >
                Cancel
              </button>
            </td>
          </tr>
        )}
      />}

      {confirm && (
        <Modal
          title={confirm.action === 'complete' ? 'Mark session complete?' : 'Cancel this session?'}
          onClose={() => setConfirm(null)}
        >
          <div style={{ padding: '0 24px 24px' }}>
            <p style={{ margin: '0 0 18px', color: 'var(--steel)', fontSize: 14.9, lineHeight: 1.5 }}>
              {confirm.action === 'complete'
                ? 'This will mark the session as completed for the member.'
                : databaseMode
                  ? 'This will cancel the session and free up the slot. Any payment or refund must be handled separately.'
                  : 'This will cancel the session and free up the slot. The member will be notified.'}
            </p>
            {confirm.action === 'cancel' && (
              <Field label="Cancellation Reason" style={{marginBottom: 16}}>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Reason for cancelling..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                />
              </Field>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" type="button" onClick={() => setConfirm(null)}>
                Keep
              </button>
              <button
                className="btn btn-signal"
                type="button"
                disabled={saving || (databaseMode && confirm.action === 'cancel' && !cancelReason.trim())}
                onClick={() => {
                  if (confirm.action === 'complete') void complete(confirm.id);
                  else void cancel(confirm.id, cancelReason || 'No reason provided');
                  if (!databaseMode) setConfirm(null);
                }}
              >
                {confirm.action === 'complete' ? 'Complete' : 'Cancel Session'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </TabbedCard>
  );
}

export default TrainerSessions;
