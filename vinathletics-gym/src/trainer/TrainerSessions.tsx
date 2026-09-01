// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, Table, Badge, Modal, Field, TextInput, Select } from '../shared';

function formatDate(iso) {
  if (!iso) return '';
  // Try to render "Aug 20, 2026" style.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function TrainerSessions({ sessions, setSessions, toast, addAudit }) {
  const [confirm, setConfirm] = useState<{ action: 'complete' | 'cancel'; id: string } | null>(null);
  const [scheduleRequest, setScheduleRequest] = useState<boolean>(false);
  const [reqForm, setReqForm] = useState({ session: '', newDateTime: '', reason: '' });

  const complete = (id) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'Completed' } : s)));
    toast('Session marked complete');
    addAudit?.('info', 'Session completed', id);
  };

  const cancel = (id) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'Cancelled' } : s)));
    toast('Session cancelled');
    addAudit?.('warn', 'Session cancelled', id);
  };

  const submitScheduleRequest = (e) => {
    e.preventDefault();
    if (!reqForm.session.trim() || !reqForm.newDateTime.trim() || !reqForm.reason.trim()) {
      toast('Please fill in all fields');
      return;
    }
    addAudit?.('info', `Schedule change requested for Session ${reqForm.session} to ${reqForm.newDateTime}. Reason: ${reqForm.reason}`);
    toast('Schedule change request sent to admin');
    setReqForm({ session: '', newDateTime: '', reason: '' });
    setScheduleRequest(false);
  };

  return (
    <TabbedCard
      label="Sessions"
      title="ASSIGNEED SESSIONS"
      right={
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setScheduleRequest(true)}
        >
          Request Schedule Change
        </button>
      }
    >
      <Table
        columns={['ID', 'MEMBER', 'DATE', 'TIME', 'TYPE', 'STATUS', '']}
        rows={sessions}
        renderRow={(s) => (
          <tr key={s.id}>
            <td className="mono">{s.id}</td>
            <td>{s.member}</td>
            <td>{formatDate(s.date)}</td>
            <td className="mono">{s.time}</td>
            <td>{s.type}</td>
            <td><Badge status={s.status} /></td>
            <td>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirm({ action: 'complete', id: s.id })}
                disabled={s.status === 'Completed' || s.status === 'Cancelled'}
              >
                Complete
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: 4, color: 'var(--danger)' }}
                onClick={() => setConfirm({ action: 'cancel', id: s.id })}
                disabled={s.status === 'Completed' || s.status === 'Cancelled'}
              >
                Cancel
              </button>
            </td>
          </tr>
        )}
      />

      {confirm && (
        <Modal
          title={confirm.action === 'complete' ? 'Mark session complete?' : 'Cancel this session?'}
          onClose={() => setConfirm(null)}
        >
          <div style={{ padding: '0 24px 24px' }}>
            <p style={{ margin: '0 0 18px', color: 'var(--steel)', fontSize: 13.5, lineHeight: 1.5 }}>
              {confirm.action === 'complete'
                ? 'This will mark the session as completed for the member.'
                : 'This will cancel the session and free up the slot.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" type="button" onClick={() => setConfirm(null)}>
                Keep
              </button>
              <button
                className="btn btn-signal"
                type="button"
                onClick={() => {
                  if (confirm.action === 'complete') complete(confirm.id);
                  else cancel(confirm.id);
                  setConfirm(null);
                }}
              >
                {confirm.action === 'complete' ? 'Complete' : 'Cancel Session'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {scheduleRequest && (
        <Modal title="REQUEST SCHEDULE CHANGE" onClose={() => setScheduleRequest(false)}>
          <form onSubmit={submitScheduleRequest} style={{ padding: '0 24px 24px' }}>
            <Field label="SESSION">
              <Select
                value={reqForm.session}
                onChange={(v) => setReqForm((f) => ({ ...f, session: v }))}
              >
                <option value="">Select a session...</option>
                {sessions
                  .filter((s) => s.status !== 'Completed' && s.status !== 'Cancelled')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.member} - {formatDate(s.date)} {s.time}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="REQUESTED NEW DATE & TIME">
              <TextInput
                type="datetime-local"
                value={reqForm.newDateTime}
                onChange={(v) => setReqForm((f) => ({ ...f, newDateTime: v }))}
              />
            </Field>
            <Field label="REASON">
              <textarea
                className="form-control"
                rows={4}
                value={reqForm.reason}
                onChange={(e) => setReqForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Why are you requesting this change?"
              />
            </Field>
            <button className="btn btn-signal btn-block" type="submit">
              Send Request
            </button>
          </form>
        </Modal>
      )}
    </TabbedCard>
  );
}

export default TrainerSessions;
