// @ts-nocheck
import { useState, useMemo } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Table, Modal, TabbedCard, TextInput, Select, Avatar, StatTile } from '../shared';

const fmt = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

function SuperAdminTrash({
  admins, setAdmins,
  members, setMembers,
  trainers, setTrainers,
  staff, setStaff,
  toast, onSuperAdminAction,
}) {
  const [q, setQ] = useState('');
  const [kindF, setKindF] = useState('all');

  const [pendingRestore, setPendingRestore] = useState(null);
  const [pendingPurge, setPendingPurge] = useState(null);
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const [selectedRestoreIds, setSelectedRestoreIds] = useState(new Set());

  const trashed = useMemo(() => {
    const out = [];
    for (const a of admins) {
      if (a.deletedAt) out.push({
        kind: 'admin', id: a.id, displayId: a.displayId, name: a.name, email: a.email, label: a.email,
        deletedAt: a.deletedAt,
      });
    }
    for (const m of members) {
      if (m.deletedAt) out.push({
        kind: 'member', id: m.id, displayId: m.displayId, name: m.name, email: m.email, plan: m.plan, label: m.plan,
        deletedAt: m.deletedAt,
      });
    }
    for (const t of trainers) {
      if (t.deletedAt) out.push({
        kind: 'trainer', id: t.id, displayId: t.displayId, name: t.name, email: '—', label: t.specialty,
        deletedAt: t.deletedAt,
      });
    }
    for (const s of staff) {
      if (s.deletedAt) out.push({
        kind: 'staff', id: s.id, displayId: s.displayId, name: s.name, email: s.email, role: s.role, label: s.role,
        deletedAt: s.deletedAt,
      });
    }
    return out;
  }, [admins, members, trainers, staff]);

  const filtered = trashed.filter((u) =>
    (kindF === 'all' || u.kind === kindF) &&
    (u.name.toLowerCase().includes(q.toLowerCase()) || (u.displayId || '').toLowerCase().includes(q.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(q.toLowerCase()))
  );

  const counts = {
    admin:   trashed.filter((u) => u.kind === 'admin').length,
    member:  trashed.filter((u) => u.kind === 'member').length,
    trainer: trashed.filter((u) => u.kind === 'trainer').length,
    staff:   trashed.filter((u) => u.kind === 'staff').length,
  };

  const applyRestore = async () => {
    if (!pendingRestore) return;
    const u = pendingRestore;
    try { await onSuperAdminAction('user.restore', { kind: u.kind, id: u.id });
      toast(`Restored — ${u.name}`); setPendingRestore(null); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not restore user'); }
  };

  const restoreKey = (user) => `${user.kind}:${user.id}`;

  const toggleRestoreSelection = (user) => {
    const key = restoreKey(user);
    setSelectedRestoreIds((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectFilteredRestoreUsers = () => {
    const visibleKeys = filtered.map(restoreKey);
    const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedRestoreIds.has(key));
    setSelectedRestoreIds((previous) => {
      const next = new Set(previous);
      for (const key of visibleKeys) {
        if (allVisibleSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  };

  const restoreSelected = async () => {
    const selected = trashed.filter((user) => selectedRestoreIds.has(restoreKey(user)));
    if (selected.length === 0) return;
    try { for (const user of selected) await onSuperAdminAction('user.restore', { kind: user.kind, id: user.id }); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not restore all users'); return; }
    toast(`Restored ${selected.length} selected user${selected.length === 1 ? '' : 's'}`);
    setSelectedRestoreIds(new Set());
    setBulkRestoreOpen(false);
  };

  const applyPurge = () => {
    if (!pendingPurge) return;
    toast('Permanent deletion requires a separate data-retention review. No record was deleted.');
    setPendingPurge(null);
  };

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatTile label="Archived Managers" value={counts.admin} />
        <StatTile label="Archived Members" value={counts.member} />
        <StatTile label="Archived Trainers" value={counts.trainer} />
        <StatTile label="Archived Staff" value={counts.staff} />
      </div>

      <div className="archive-table"><TabbedCard
        title="Archive"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={trashed.length === 0}
              onClick={() => {
                setSelectedRestoreIds(new Set());
                setBulkRestoreOpen(true);
              }}
            >
              BULK RESTORE
            </button>
          </div>
        }
      >
        <div className="search-row">
          <TextInput placeholder="Search by name or email…" value={q} onChange={setQ} />
          <Select value={kindF} onChange={setKindF} style={{ maxWidth: 160 }}>
            <option value="all">All Roles</option>
            <option value="admin">Managers</option>
            <option value="member">Members</option>
            <option value="trainer">Trainers</option>
            <option value="staff">Staff</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div style={{ fontSize: 14.3, color: 'var(--steel)', padding: '14px 0' }}>
            Nothing in the archive. Removed users will appear here so you can restore or delete them.
          </div>
        ) : (
          <Table
            columns={['User', 'Email', 'Role / Plan', 'Deleted At', '']}
            rows={filtered}
            renderRow={(u) => (
              <tr key={u.kind + '-' + u.id}>
                <td>
                  <Avatar src={null} name={u.name} />
                  {u.name}
                  <div className="mono" style={{ fontSize: 11.6, color: 'var(--steel)' }}>{u.displayId || u.id}</div>
                </td>
                <td style={{ fontSize: 13.8 }}>{u.email}</td>
                <td>
                  <span style={{ textTransform: 'capitalize' }}>{u.kind === 'admin' ? 'Manager' : u.kind}</span>
                  <div style={{ fontSize: 12.7, color: 'var(--steel)' }}>{u.label}</div>
                </td>
                <td className="mono" style={{ fontSize: 13.2 }}>{fmt(u.deletedAt)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm archive-restore" onClick={() => setPendingRestore(u)}>
                      <RotateCcw size={15} aria-hidden="true" /> Restore
                    </button>
                    <button className="btn btn-danger-ghost btn-sm archive-delete" onClick={() => setPendingPurge(u)}>
                      <Trash2 size={15} aria-hidden="true" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />
        )}
      </TabbedCard></div>

      {bulkRestoreOpen && (
        <Modal className="bulk-restore-modal" title="Select Users to Restore" showCloseButton onClose={() => setBulkRestoreOpen(false)} wide>
          <div className="bulk-restore-selection">
            <div className="bulk-restore-toolbar">
              <label>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((user) => selectedRestoreIds.has(restoreKey(user)))}
                  onChange={toggleSelectFilteredRestoreUsers}
                />
                Select all shown
              </label>
              <span>{selectedRestoreIds.size} selected</span>
            </div>
            <div className="bulk-restore-list">
              {filtered.length === 0 ? (
                <p>No archived users match the current search or role filter.</p>
              ) : filtered.map((user) => (
                <label className="bulk-restore-user" key={restoreKey(user)}>
                  <input
                    type="checkbox"
                    checked={selectedRestoreIds.has(restoreKey(user))}
                    onChange={() => toggleRestoreSelection(user)}
                  />
                  <span className="bulk-restore-user-copy">
                    <strong>{user.name}</strong>
                    <span>{user.email} · {user.kind} · {user.label}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="bulk-restore-actions">
              <button className="btn btn-outline" type="button" onClick={() => setBulkRestoreOpen(false)}>Cancel</button>
              <button className="btn btn-signal" type="button" disabled={selectedRestoreIds.size === 0} onClick={restoreSelected}>
                Restore Selected ({selectedRestoreIds.size})
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pendingRestore && (
        <Modal title="Restore User?" showCloseButton={false} onClose={() => setPendingRestore(null)}>
          <p style={{ fontSize: 14.3, color: 'var(--steel)', marginBottom: 14 }}>
            You're about to restore <b>{pendingRestore.name}</b>. They'll reappear in the active list
            for their role and can be edited or removed again normally.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setPendingRestore(null)}>
              Cancel
            </button>
            <button
              className="btn btn-signal"
              type="button"
              onClick={applyRestore}
              style={{ background: 'var(--court)', borderColor: 'var(--court)' }}
            >
              Restore
            </button>
          </div>
        </Modal>
      )}

      {pendingPurge && (
        <Modal title="Delete?" showCloseButton={false} onClose={() => setPendingPurge(null)}>
          <p style={{ fontSize: 14.3, color: 'var(--steel)', marginBottom: 14 }}>
            You're about to delete <b>{pendingPurge.name}</b>. This action cannot be
            undone — their record and references will be removed from the system.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setPendingPurge(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" type="button" onClick={applyPurge}>
              Delete
            </button>
          </div>
        </Modal>
      )}

    </>
  );
}

export default SuperAdminTrash;
