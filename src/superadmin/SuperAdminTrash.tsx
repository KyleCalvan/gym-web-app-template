// @ts-nocheck
import { useState, useMemo, useEffect, useCallback } from 'react';
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
  toast, addAudit = null, databaseMode = false,
}) {
  const [loading, setLoading] = useState(databaseMode);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/superadmin/users', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Archive could not be loaded.');
    setAdmins(result.admins);
    setMembers(result.members);
    setTrainers(result.trainers);
    setStaff(result.staff);
  }, [setAdmins, setMembers, setTrainers, setStaff]);
  useEffect(() => {
    if (!databaseMode) return;
    let active = true;
    refresh().then(() => { if (active) setLoadError(''); })
      .catch(error => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [databaseMode, refresh]);
  const mutate = async (method, body) => {
    const response = await fetch('/api/superadmin/users', {
      method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Archive could not be updated.');
  };
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
        kind: 'admin', id: a.id, name: a.name, email: a.email, label: a.email,
        deletedAt: a.deletedAt, linkedAccount: a.linkedAccount,
      });
    }
    for (const m of members) {
      if (m.deletedAt) out.push({
        kind: 'member', id: m.id, name: m.name, email: m.email, plan: m.plan, label: m.plan,
        deletedAt: m.deletedAt, linkedAccount: m.linkedAccount,
      });
    }
    for (const t of trainers) {
      if (t.deletedAt) out.push({
        kind: 'trainer', id: t.id, name: t.name, email: t.email || '—', label: t.specialty,
        deletedAt: t.deletedAt, linkedAccount: t.linkedAccount,
      });
    }
    for (const s of staff) {
      if (s.deletedAt) out.push({
        kind: 'staff', id: s.id, name: s.name, email: s.email, role: s.role, label: s.role,
        deletedAt: s.deletedAt, linkedAccount: s.linkedAccount,
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

  const applyRestore = async () => {
    if (!pendingRestore) return;
    const u = pendingRestore;
    setSaving(true);
    try {
      if (databaseMode) {
        await mutate('PATCH', { id: u.id, kind: u.kind, action: 'restore' });
        await refresh();
      } else {
        const setters = { admin: setAdmins, member: setMembers, trainer: setTrainers, staff: setStaff };
        setters[u.kind](previous => previous.map(user => user.id === u.id ? { ...user, deletedAt: null } : user));
        addAudit?.('info', 'Restored from archive', `${u.name} (${u.id})`);
      }
      toast(`Restored — ${u.name}`);
      setPendingRestore(null);
    } catch (error) { toast(error.message); }
    finally { setSaving(false); }
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
    const visibleKeys = filtered.filter(user => !databaseMode || !user.linkedAccount).map(restoreKey);
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
    setSaving(true);
    try {
      if (databaseMode) {
        await mutate('PATCH', { action: 'restore-many', users: selected.map(user => ({ id: user.id, kind: user.kind })) });
        await refresh();
      } else {
        const setters = { admin: setAdmins, member: setMembers, trainer: setTrainers, staff: setStaff };
        for (const kind of ['admin', 'member', 'trainer', 'staff']) {
          const ids = new Set(selected.filter(user => user.kind === kind).map(user => user.id));
          setters[kind](previous => previous.map(user => ids.has(user.id) ? { ...user, deletedAt: null } : user));
        }
        addAudit?.('info', 'Bulk restored archive', `Restored ${selected.length} selected users`);
      }
      toast(`Restored ${selected.length} selected user${selected.length === 1 ? '' : 's'}`);
      setSelectedRestoreIds(new Set());
      setBulkRestoreOpen(false);
    } catch (error) { if (databaseMode) await refresh().catch(() => {}); toast(error.message); }
    finally { setSaving(false); }
  };

  const applyPurge = async () => {
    if (!pendingPurge) return;
    const u = pendingPurge;
    setSaving(true);
    try {
      if (databaseMode) {
        await mutate('DELETE', { id: u.id, kind: u.kind });
        await refresh();
      } else {
        const setters = { admin: setAdmins, member: setMembers, trainer: setTrainers, staff: setStaff };
        setters[u.kind](previous => previous.filter(user => user.id !== u.id));
        addAudit?.('error', 'Deleted', `${u.name} (${u.id})`);
      }
      toast(`Deleted role — ${u.name}`);
      setPendingPurge(null);
    } catch (error) { toast(error.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      {loading && <p role="status">Loading archive…</p>}
      {loadError && <div role="alert">{loadError} <button className="btn btn-outline btn-sm" onClick={() => { setLoading(true); refresh().then(() => setLoadError('')).catch(error => setLoadError(error.message)).finally(() => setLoading(false)); }}>Retry</button></div>}
      {!loading && !loadError && <>
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
                  <div className="mono" style={{ fontSize: 11.6, color: 'var(--steel)' }}>{u.id}</div>
                </td>
                <td style={{ fontSize: 13.8 }}>{u.email}</td>
                <td>
                  <span style={{ textTransform: 'capitalize' }}>{u.kind === 'admin' ? 'Manager' : u.kind}</span>
                  <div style={{ fontSize: 12.7, color: 'var(--steel)' }}>{u.label}</div>
                </td>
                <td className="mono" style={{ fontSize: 13.2 }}>{fmt(u.deletedAt)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm archive-restore" disabled={databaseMode && u.linkedAccount} title={databaseMode && u.linkedAccount ? 'Online Accounts require the verified authority flow' : undefined} onClick={() => setPendingRestore(u)}>
                      <RotateCcw size={15} aria-hidden="true" /> Restore
                    </button>
                    <button className="btn btn-danger-ghost btn-sm archive-delete" disabled={databaseMode && u.linkedAccount} title={databaseMode && u.linkedAccount ? 'Online Accounts require the verified authority flow' : undefined} onClick={() => setPendingPurge(u)}>
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
                  checked={filtered.some(user => !databaseMode || !user.linkedAccount) && filtered.filter(user => !databaseMode || !user.linkedAccount).every((user) => selectedRestoreIds.has(restoreKey(user)))}
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
                    disabled={databaseMode && user.linkedAccount}
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
              <button className="btn btn-signal" type="button" disabled={saving || selectedRestoreIds.size === 0} onClick={restoreSelected}>
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
              disabled={saving}
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
            You're about to permanently delete <b>{pendingPurge.name}</b>'s archived role. Roles with linked history cannot be deleted.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setPendingPurge(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" type="button" disabled={saving} onClick={applyPurge}>
              Delete
            </button>
          </div>
        </Modal>
      )}

      </>}
    </>
  );
}

export default SuperAdminTrash;
