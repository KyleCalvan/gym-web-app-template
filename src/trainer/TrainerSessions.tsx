// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, Table, Badge, Modal, Field, TextInput, Select } from '../shared';
import { formatTime12h } from './availability.ts';

function formatDate(iso) {
  if (!iso) return '';
  // Try to render "Aug 20, 2026" style.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function TrainerSessions({ sessions, toast, onTrainerAction }) {
  const [confirm, setConfirm] = useState<{ action: 'complete' | 'cancel'; id: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [scheduleRequest, setScheduleRequest] = useState<boolean>(false);
  const [reqForm, setReqForm] = useState({ session: '', newDateTime: '', reason: '' });

  const complete = async (id) => {
    try { await onTrainerAction('session.complete', { id }); toast('Session marked complete'); setConfirm(null); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not complete the session'); }
  };

  const cancel = async (id, reason) => {
    try { await onTrainerAction('session.cancel', { id, reason }); toast('Session cancelled'); setConfirm(null); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not cancel the session'); }
  };

  const submitScheduleRequest = async (e) => {
    e.preventDefault();
    if (!reqForm.session.trim() || !reqForm.newDateTime.trim() || !reqForm.reason.trim()) {
      toast('Please fill in all fields');
      return;
    }
    try {
      await onTrainerAction('session.request-change', { id: reqForm.session,
        requestedStartsAt: new Date(`${reqForm.newDateTime}+08:00`).toISOString(), reason: reqForm.reason });
      toast('Schedule change request sent'); setScheduleRequest(false);
      setReqForm({ session: '', newDateTime: '', reason: '' });
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not send the request'); }
  };

  return (
    <TabbedCard
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
            <td className="mono">{formatTime12h(s.time)}</td>
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
                onClick={() => {
                  setCancelReason('');
                  setConfirm({ action: 'cancel', id: s.id });
                }}
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
            <p style={{ margin: '0 0 18px', color: 'var(--steel)', fontSize: 14.9, lineHeight: 1.5 }}>
              {confirm.action === 'complete'
                ? 'This will mark the session as completed for the member.'
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
                onClick={() => {
                  if (confirm.action === 'complete') void complete(confirm.id);
                  else void cancel(confirm.id, cancelReason || 'No reason provided');
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
                      {s.member} - {formatDate(s.date)} {formatTime12h(s.time)}
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
