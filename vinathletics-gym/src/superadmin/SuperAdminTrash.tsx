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
    addAudit?.('info', 'Restored from trash', `${u.name} (${u.id})`);
    toast(`Restored — ${u.name}`);
    setPendingRestore(null);
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

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="stat-tile"><div className="eyebrow">Admins in Archive</div><div className="num">{counts.admin}</div></div>
        <div className="stat-tile"><div className="eyebrow">Members in Archive</div><div className="num">{counts.member}</div></div>
        <div className="stat-tile"><div className="eyebrow">Trainers in Archive</div><div className="num">{counts.trainer}</div></div>
        <div className="stat-tile"><div className="eyebrow">Staff in Archive</div><div className="num">{counts.staff}</div></div>
      </div>

      <TabbedCard label="Maintenance" title="Archive">
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
            The archive is empty. Removed users will appear here so you can restore or permanently delete them.
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
                    <button className="btn btn-outline btn-sm" onClick={() => setPendingRestore(u)}>
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
        <Modal title="Restore User?" onClose={() => setPendingRestore(null)}>
          <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 14 }}>
            You're about to restore <b>{pendingRestore.name}</b>. They'll reappear in the active list
            for their role and can be edited or removed again normally.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setPendingRestore(null)}>
              Cancel
            </button>
            <button className="btn btn-signal" type="button" onClick={applyRestore}>
              Restore
            </button>
          </div>
        </Modal>
      )}

      {pendingPurge && (
        <Modal title="Delete Permanently?" onClose={() => setPendingPurge(null)}>
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
    </>
  );
}

export default SuperAdminTrash;
