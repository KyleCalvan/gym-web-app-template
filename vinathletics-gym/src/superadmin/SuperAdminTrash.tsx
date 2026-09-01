// @ts-nocheck
import { useState, useMemo } from 'react';
import { Table, Modal, TabbedCard, TextInput, Select, Avatar } from '../shared';

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
  toast, addAudit,
}) {
  const [q, setQ] = useState('');
  const [kindF, setKindF] = useState('all');

  const [pendingRestore, setPendingRestore] = useState(null);
  const [pendingPurge, setPendingPurge] = useState(null);
  const [confirmRestoreAll, setConfirmRestoreAll] = useState(false);
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false);

  const trashed = useMemo(() => {
    const out = [];
    for (const a of admins) {
      if (a.deletedAt) out.push({
        kind: 'admin', id: a.id, name: a.name, email: a.email, label: a.email,
        deletedAt: a.deletedAt,
      });
    }
    for (const m of members) {
      if (m.deletedAt) out.push({
        kind: 'member', id: m.id, name: m.name, email: m.email, plan: m.plan, label: m.plan,
        deletedAt: m.deletedAt,
      });
    }
    for (const t of trainers) {
      if (t.deletedAt) out.push({
        kind: 'trainer', id: t.id, name: t.name, email: '—', label: t.specialty,
        deletedAt: t.deletedAt,
      });
    }
    for (const s of staff) {
      if (s.deletedAt) out.push({
        kind: 'staff', id: s.id, name: s.name, email: s.email, role: s.role, label: s.role,
        deletedAt: s.deletedAt,
      });
    }
    return out;
  }, [admins, members, trainers, staff]);

  const filtered = trashed.filter((u) =>
    (kindF === 'all' || u.kind === kindF) &&
    (u.name.toLowerCase().includes(q.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(q.toLowerCase()))
  );

  const counts = {
    admin:   trashed.filter((u) => u.kind === 'admin').length,
    member:  trashed.filter((u) => u.kind === 'member').length,
    trainer: trashed.filter((u) => u.kind === 'trainer').length,
    staff:   trashed.filter((u) => u.kind === 'staff').length,
  };

  const applyRestore = () => {
    if (!pendingRestore) return;
    const u = pendingRestore;
    const clear = (prev) => prev.map((x) => (x.id === u.id ? { ...x, deletedAt: null } : x));
    if (u.kind === 'admin')        setAdmins(clear);
    else if (u.kind === 'member')  setMembers(clear);
    else if (u.kind === 'trainer') setTrainers(clear);
    else if (u.kind === 'staff')   setStaff(clear);
    addAudit?.('info', 'Restored from archive', `${u.name} (${u.id})`);
    toast(`Restored — ${u.name}`);
    setPendingRestore(null);
  };

  const restoreAll = () => {
    setAdmins(prev => prev.map(a => a.deletedAt ? { ...a, deletedAt: null } : a));
    setMembers(prev => prev.map(m => m.deletedAt ? { ...m, deletedAt: null } : m));
    setTrainers(prev => prev.map(t => t.deletedAt ? { ...t, deletedAt: null } : t));
    setStaff(prev => prev.map(s => s.deletedAt ? { ...s, deletedAt: null } : s));
    addAudit?.('info', 'Bulk restored archive', 'All archived users restored');
    toast('All users restored from archive');
    setConfirmRestoreAll(false);
  };

  const applyPurge = () => {
    if (!pendingPurge) return;
    const u = pendingPurge;
    const drop = (prev) => prev.filter((x) => x.id !== u.id);
    if (u.kind === 'admin')        setAdmins(drop);
    else if (u.kind === 'member')  setMembers(drop);
    else if (u.kind === 'trainer') setTrainers(drop);
    else if (u.kind === 'staff')   setStaff(drop);
    addAudit?.('error', 'Permanently deleted', `${u.name} (${u.id})`);
    toast(`Deleted permanently — ${u.name}`);
    setPendingPurge(null);
  };

  const purgeAll = () => {
    setAdmins(prev => prev.filter(a => !a.deletedAt));
    setMembers(prev => prev.filter(m => !m.deletedAt));
    setTrainers(prev => prev.filter(t => !t.deletedAt));
    setStaff(prev => prev.filter(s => !s.deletedAt));
    addAudit?.('error', 'Bulk purged archive', 'All archived users permanently deleted');
    toast('Archive permanently cleared');
    setConfirmPurgeAll(false);
  };

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="stat-tile"><div className="eyebrow">Archived Admins</div><div className="num">{counts.admin}</div></div>
        <div className="stat-tile"><div className="eyebrow">Archived Members</div><div className="num">{counts.member}</div></div>
        <div className="stat-tile"><div className="eyebrow">Archived Trainers</div><div className="num">{counts.trainer}</div></div>
        <div className="stat-tile"><div className="eyebrow">Archived Staff</div><div className="num">{counts.staff}</div></div>
      </div>

      <TabbedCard
        label="Maintenance"
        title="Archive"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setConfirmRestoreAll(true)}>BULK RESTORE</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmPurgeAll(true)}>BULK REMOVE</button>
          </div>
        }
      >
        <div className="search-row">
          <TextInput placeholder="Search by name or email…" value={q} onChange={setQ} />
          <Select value={kindF} onChange={setKindF} style={{ maxWidth: 160 }}>
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="member">Members</option>
            <option value="trainer">Trainers</option>
            <option value="staff">Staff</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--steel)', padding: '14px 0' }}>
            Nothing in the archive. Removed users will appear here so you can restore or permanently delete them.
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
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--steel)' }}>{u.id}</div>
                </td>
                <td style={{ fontSize: 12.5 }}>{u.email}</td>
                <td>
                  <span style={{ textTransform: 'capitalize' }}>{u.kind}</span>
                  <div style={{ fontSize: 11.5, color: 'var(--steel)' }}>{u.label}</div>
                </td>
                <td className="mono" style={{ fontSize: 12 }}>{fmt(u.deletedAt)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-signal btn-sm" style={{ background: 'var(--court)', borderColor: 'var(--court)' }} onClick={() => setPendingRestore(u)}>
                      Restore
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => setPendingPurge(u)}>
                      Delete Permanently
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />
        )}
      </TabbedCard>

      {pendingRestore && (
        <Modal title="Restore User?" showCloseButton={false} onClose={() => setPendingRestore(null)}>
          <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 14 }}>
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
        <Modal title="Delete Permanently?" showCloseButton={false} onClose={() => setPendingPurge(null)}>
          <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 14 }}>
            You're about to permanently delete <b>{pendingPurge.name}</b>. This action cannot be
            undone — their record and references will be removed from the system.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setPendingPurge(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" type="button" onClick={applyPurge}>
              Delete Permanently
            </button>
          </div>
        </Modal>
      )}

      {confirmRestoreAll && (
        <Modal title="Restore All Users?" showCloseButton={false} onClose={() => setConfirmRestoreAll(false)}>
          <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 14 }}>
            Are you sure you want to restore all archived users? They will be moved back to their respective active lists.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setConfirmRestoreAll(false)}>
              Cancel
            </button>
            <button
              className="btn btn-signal"
              type="button"
              onClick={restoreAll}
              style={{ background: 'var(--court)', borderColor: 'var(--court)' }}
            >
              Restore All
            </button>
          </div>
        </Modal>
      )}

      {confirmPurgeAll && (
        <Modal title="Purge All Users?" showCloseButton={false} onClose={() => setConfirmPurgeAll(false)}>
          <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 14 }}>
            Are you sure you want to permanently delete all archived users? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setConfirmPurgeAll(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" type="button" onClick={purgeAll}>
              Delete Permanently
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default SuperAdminTrash;
