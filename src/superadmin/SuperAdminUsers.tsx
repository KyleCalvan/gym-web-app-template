// @ts-nocheck
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Badge, Table, Modal, Field, TextInput, Select, TabbedCard, Avatar, StatTile } from '../shared';
import { NameFields } from '../shared/components/NameFields';
import { emptyName, formatName, splitName } from '../shared/nameParts';

// Normalized user shape used in the unified table.
function buildUsers({ admins, members, trainers, staff }) {
  const out = [];
  for (const a of admins)    if (!a.deletedAt) out.push({ kind: 'admin',   id: a.id, name: a.name,   email: a.email, linkedAccount: a.linkedAccount, status: a.status,   label: a.status === 'Active' ? 'Manager' : 'Inactive Manager' });
  for (const m of members)   if (!m.deletedAt) out.push({ kind: 'member',  id: m.id, name: m.name,   email: m.email, phone: m.phone, linkedAccount: m.linkedAccount, plan: m.plan, status: m.status, label: m.status === 'No Membership' && m.plan ? `${m.plan} (interest)` : m.plan || 'No plan selected' });
  for (const t of trainers)  if (!t.deletedAt) out.push({ kind: 'trainer', id: t.id, name: t.name,   email: t.email || '—', linkedAccount: t.linkedAccount, status: t.status, label: t.specialty });
  for (const s of staff)     if (!s.deletedAt) out.push({ kind: 'staff',   id: s.id, name: s.name,   email: s.email, phone: s.phone, linkedAccount: s.linkedAccount, status: s.status, label: s.role });
  return out;
}

function SuperAdminUsers({
  admins, setAdmins,
  members, setMembers,
  trainers, setTrainers,
  staff, setStaff,
  plans, toast, today = '', addAudit = null, databaseMode = false,
}) {
  const [loading, setLoading] = useState(databaseMode);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/superadmin/users', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Users could not be loaded.');
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
  const save = async (method, body) => {
    setSaving(true);
    try {
      const response = await fetch('/api/superadmin/users', {
        method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'User could not be saved.');
      await refresh();
      return true;
    } catch (error) {
      toast(error.message || 'User could not be saved.');
      return false;
    } finally { setSaving(false); }
  };
  const [pendingRemove, setPendingRemove] = useState(null);
  const removeUser = async () => {
    if (!pendingRemove) return;
    if (databaseMode) {
      if (!await save('PATCH', { id: pendingRemove.id, kind: pendingRemove.kind, action: 'archive' })) return;
    } else {
      const setters = { admin: setAdmins, member: setMembers, trainer: setTrainers, staff: setStaff };
      setters[pendingRemove.kind](previous => previous.map(user => user.id === pendingRemove.id
        ? { ...user, deletedAt: new Date().toISOString() } : user));
      addAudit?.('warn', 'User archived', `${pendingRemove.name} (${pendingRemove.id})`);
    }
    toast(pendingRemove.name + ' moved to Archive');
    setPendingRemove(null);
  };
  const [q, setQ] = useState('');
  const [kindF, setKindF] = useState('all');
  const [statusF, setStatusF] = useState('All');

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [adding, setAdding] = useState(false);
  const [addKind, setAddKind] = useState('admin');
  const [addForm, setAddForm] = useState({
    ...emptyName(), email: '', phone: '', plan: 'Premium',
    specialty: 'General', certs: '', sessionPrice: '900',
    role: 'Front Desk', shift: 'Morning',
    status: 'Active',
  });

  const [confirmAdd, setConfirmAdd] = useState(false);
  const [pendingAddForm, setPendingAddForm] = useState(null);

  const users = useMemo(() => buildUsers({ admins, members, trainers, staff }), [admins, members, trainers, staff]);
  const filtered = users.filter((u) =>
    (kindF === 'all' || u.kind === kindF) &&
    (statusF === 'All' || u.status === statusF || u.kind === 'admin' && statusF === 'All' && u.status === 'Inactive') &&
    (u.name.toLowerCase().includes(q.toLowerCase()) || (u.email || '').toLowerCase().includes(q.toLowerCase()))
  );

  const counts = {
    admin:   admins.filter((a) => !a.deletedAt).length,
    member:  members.filter((m) => !m.deletedAt).length,
    trainer: trainers.filter((t) => !t.deletedAt && t.status !== 'Inactive').length,
    staff:   staff.filter((s) => !s.deletedAt).length,
  };

  const startEdit = (u) => {
    setEditing(u);
    const { firstName, middleName, lastName, suffix } = splitName(u);
    if (u.kind === 'admin')   setEditForm({ firstName, lastName, middleName, suffix, email: u.email, phone: u.phone || '', status: u.status, changeRole: 'admin' });
    if (u.kind === 'member')  setEditForm({ firstName, lastName, middleName, suffix, email: u.email, phone: u.phone, plan: members.find(m => m.id === u.id)?.planInterest || u.plan || plans[0]?.name || '', changeRole: 'member' });
    if (u.kind === 'trainer') setEditForm({ firstName, lastName, middleName, suffix, email: u.email || '', phone: u.phone || '', specialty: u.label, certs: trainers.find((t) => t.id === u.id)?.certs || '', sessionPrice: String(trainers.find((t) => t.id === u.id)?.sessionPrice ?? 900), status: u.status, changeRole: 'trainer' });
    if (u.kind === 'staff')   setEditForm({ ...staff.find((s) => s.id === u.id), firstName, lastName, middleName, suffix, changeRole: 'staff' });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editing || !editForm) return;
    if (databaseMode) {
      if (!await save('PATCH', { ...editForm, id: editing.id, kind: editing.kind })) return;
    } else {
      const fullName = formatName(editForm);
      const setters = { admin: setAdmins, member: setMembers, trainer: setTrainers, staff: setStaff };
      setters[editing.kind](previous => previous.map(user => user.id === editing.id
        ? { ...user, ...editForm, name: fullName,
          ...(editing.kind === 'trainer' ? { sessionPrice: Number(editForm.sessionPrice) || 900 } : {}) } : user));
      addAudit?.('info', 'User updated', `${fullName} (${editing.id})`);
    }
    toast('User updated — ' + formatName(editForm));
    setEditing(null);
    setEditForm(null);
  };

  const submitAdd = (e) => {
    e.preventDefault();
    const fullName = formatName(addForm);
    if (!fullName) { toast('Name is required'); return; }
    setPendingAddForm({ ...addForm, name: fullName });
    setConfirmAdd(true);
  };

  const finalizeAdd = async () => {
    if (!pendingAddForm) return;
    const form = pendingAddForm;
    if (databaseMode) {
      if (!await save('POST', { ...form, kind: addKind })) return;
    } else {
      const ids = { admin: `SA-${String(admins.length + 1).padStart(2, '0')}`,
        member: `M-${1042 + members.length}`, trainer: `T-0${trainers.length + 1}`,
        staff: `S-${String(staff.length + 1).padStart(2, '0')}` };
      const id = ids[addKind];
      if (addKind === 'admin') setAdmins(previous => [...previous, { id, name: form.name, email: form.email, phone: form.phone, status: form.status, createdAt: today }]);
      if (addKind === 'member') setMembers(previous => [...previous, { id, name: form.name, email: form.email, phone: form.phone, plan: form.plan, status: 'Active', joined: today }]);
      if (addKind === 'trainer') setTrainers(previous => [...previous, { id, name: form.name, email: form.email, phone: form.phone, specialty: form.specialty, certs: form.certs,
        rating: 0, sessionsWeek: 0, status: form.status, sessionPrice: Number(form.sessionPrice) || 900, reviews: [] }]);
      if (addKind === 'staff') setStaff(previous => [...previous, { id, name: form.name, email: form.email, phone: form.phone, role: form.role, shift: form.shift, status: form.status, hireDate: today }]);
      addAudit?.('info', 'User registered', `${form.name} (${id})`);
    }
    toast('User added — ' + form.name);
    setAdding(false);
    setConfirmAdd(false);
    setPendingAddForm(null);
    setAddForm({ ...emptyName(), email: '', phone: '', plan: 'Premium', specialty: 'General', certs: '', sessionPrice: '900', role: 'Front Desk', shift: 'Morning', status: 'Active' });
  };

  return (
    <>
      {loading && <p role="status">Loading users…</p>}
      {loadError && <div role="alert">{loadError} <button className="btn btn-outline btn-sm" onClick={() => { setLoading(true); refresh().then(() => setLoadError('')).catch(error => setLoadError(error.message)).finally(() => setLoading(false)); }}>Retry</button></div>}
      {!loading && !loadError && <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatTile label="Managers" value={counts.admin} />
        <StatTile label="Members" value={counts.member} />
        <StatTile label="Active Trainers" value={counts.trainer} />
        <StatTile label="Staff" value={counts.staff} />
      </div>

      <TabbedCard
        title="All Users"
        right={
          <div className="user-management-actions">
            <button className="btn btn-outline btn-sm" onClick={() => { setAddKind('admin'); setAdding(true); }}>+ Add Manager</button>
            <button className="btn btn-outline btn-sm" onClick={() => { setAddKind('trainer'); setAdding(true); }}>+ Add Trainer</button>
            <button className="btn btn-outline btn-sm" onClick={() => { setAddKind('staff'); setAdding(true); }}>+ Add Staff</button>
            <button className="btn btn-signal btn-sm" onClick={() => { setAddKind('member'); setAddForm(form => ({ ...form, plan: plans.find(plan => plan.name === 'Premium')?.name || plans[0]?.name || '' })); setAdding(true); }}>+ Register Member</button>
          </div>
        }
      >
        <div className="search-row">
          <TextInput placeholder="Search by name or email…" value={q} onChange={setQ} />
          <Select value={kindF} onChange={setKindF} style={{ maxWidth: 140 }}>
            <option value="all">All Roles</option>
            <option value="admin">Managers</option>
            <option value="member">Members</option>
            <option value="trainer">Trainers</option>
            <option value="staff">Staff</option>
          </Select>
          <Select value={statusF} onChange={setStatusF} style={{ maxWidth: 160 }}>
            {['All','Active','Inactive','On Leave','Frozen','Expiring','Expired'].map((s) => <option key={s} value={s}>{s === 'Expiring' ? 'Expire' : s}</option>)}
          </Select>
        </div>

        <Table
          columns={['User','Email / Phone','Role / Plan','Status','']}
          rows={filtered}
          renderRow={(u) => (
            <tr key={u.kind + '-' + u.id}>
              <td>
                <Avatar src={null} name={u.name} />
                {u.name}
                <div className="mono" style={{ fontSize: 11.6, color: 'var(--steel)' }}>{u.id}</div>
              </td>
              <td>
                <div style={{ fontSize: 13.8 }}>{u.email}</div>
                {u.phone && <div className="mono" style={{ fontSize: 12.1, color: 'var(--steel)' }}>{u.phone}</div>}
              </td>
              <td>
                <span style={{ textTransform: 'capitalize' }}>{u.kind === 'admin' ? 'Manager' : u.kind}</span>
                <div style={{ fontSize: 12.7, color: 'var(--steel)' }}>{u.label}</div>
              </td>
              <td><Badge status={u.status} /></td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline btn-sm" disabled={databaseMode && u.linkedAccount} title={databaseMode && u.linkedAccount ? 'Online Accounts require the verified authority flow' : undefined} onClick={() => startEdit(u)}>Edit</button>
                  <button className="btn btn-danger-ghost btn-sm" disabled={databaseMode && u.linkedAccount} title={databaseMode && u.linkedAccount ? 'Online Accounts require the verified authority flow' : undefined} onClick={() => setPendingRemove(u)}>Remove</button>
                </div>
              </td>
            </tr>
          )}
        />
      </TabbedCard>

      {pendingRemove && <Modal title="Move user to Archive?" onClose={() => setPendingRemove(null)}>
        <p>{pendingRemove.name} will leave the active user list. You can restore this record from Archive.</p>
        <div className="dialog-actions"><button className="btn btn-outline" onClick={() => setPendingRemove(null)}>Cancel</button><button className="btn btn-danger" disabled={saving} onClick={removeUser}>Move to Archive</button></div>
      </Modal>}
      {/* ===== Add modal ===== */}
      {adding && (
        <Modal title={`Add ${addKind === 'admin' ? 'Manager' : addKind === 'member' ? 'Member' : addKind === 'trainer' ? 'Trainer' : 'Staff'}`} onClose={() => setAdding(false)}>
          <form onSubmit={submitAdd}>
            {addKind === 'admin' && (
              <>
                <NameFields value={addForm} onChange={parts => setAddForm(form => ({...form,...parts}))} />
                <Field label="Email"><TextInput type="email" required value={addForm.email} onChange={(v) => setAddForm((f) => ({ ...f, email: v }))} placeholder="admin@vinathletics.gym" /></Field>
                <Field label="Phone"><TextInput value={addForm.phone} onChange={(v) => setAddForm((f) => ({ ...f, phone: v }))} placeholder="+63 9XX XXX XXXX" /></Field>
                <Field label="Status">
                  <Select value={addForm.status} onChange={(v) => setAddForm((f) => ({ ...f, status: v }))}>
                    <option>Active</option><option>Inactive</option>
                  </Select>
                </Field>
              </>
            )}
            {addKind === 'member' && (
              <>
                <NameFields value={addForm} onChange={parts => setAddForm(form => ({...form,...parts}))} />
                <Field label="Email"><TextInput type="email" required value={addForm.email} onChange={(v) => setAddForm((f) => ({ ...f, email: v }))} /></Field>
                <Field label="Phone"><TextInput value={addForm.phone} onChange={(v) => setAddForm((f) => ({ ...f, phone: v }))} placeholder="+63 9XX XXX XXXX" /></Field>
                <Field label="Plan Interest">
                  <Select value={addForm.plan} onChange={(v) => setAddForm((f) => ({ ...f, plan: v }))}>
                    {plans.map(plan => <option key={plan.name}>{plan.name}</option>)}
                  </Select>
                </Field>
              </>
            )}
            {addKind === 'trainer' && (
              <>
                <NameFields value={addForm} onChange={parts => setAddForm(form => ({...form,...parts}))} />
                <Field label="Email"><TextInput type="email" required value={addForm.email} onChange={(v) => setAddForm((f) => ({ ...f, email: v }))} placeholder="trainer@vinathletics.gym" /></Field>
                <Field label="Phone"><TextInput value={addForm.phone} onChange={(v) => setAddForm((f) => ({ ...f, phone: v }))} placeholder="+63 9XX XXX XXXX" /></Field>
                <Field label="Specialty"><TextInput value={addForm.specialty} onChange={(v) => setAddForm((f) => ({ ...f, specialty: v }))} /></Field>
                <Field label="Certifications"><TextInput value={addForm.certs} onChange={(v) => setAddForm((f) => ({ ...f, certs: v }))} placeholder="e.g. NASM-CPT" /></Field>
                <Field label="Session Price (₱)"><TextInput type="number" required value={addForm.sessionPrice} onChange={(v) => setAddForm((f) => ({ ...f, sessionPrice: v }))} /></Field>
                <Field label="Status">
                  <Select value={addForm.status} onChange={(v) => setAddForm((f) => ({ ...f, status: v }))}>
                    <option>Active</option><option>On Leave</option><option>Inactive</option>
                  </Select>
                </Field>
              </>
            )}
            {addKind === 'staff' && (
              <>
                <NameFields value={addForm} onChange={parts => setAddForm(form => ({...form,...parts}))} />
                <Field label="Email"><TextInput type="email" required value={addForm.email} onChange={(v) => setAddForm((f) => ({ ...f, email: v }))} placeholder="name@vinathletics.gym" /></Field>
                <Field label="Phone"><TextInput value={addForm.phone} onChange={(v) => setAddForm((f) => ({ ...f, phone: v }))} placeholder="+63 9XX XXX XXXX" /></Field>
                <Field label="Role">
                  <Select value={addForm.role} onChange={(v) => setAddForm((f) => ({ ...f, role: v }))}>
                    <option>Front Desk</option><option>Sales</option><option>Manager</option>
                  </Select>
                </Field>
                <Field label="Shift">
                  <Select value={addForm.shift} onChange={(v) => setAddForm((f) => ({ ...f, shift: v }))}>
                    <option>Morning</option><option>Evening</option><option>Night</option>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={addForm.status} onChange={(v) => setAddForm((f) => ({ ...f, status: v }))}>
                    <option>Active</option><option>On Leave</option><option>Inactive</option>
                  </Select>
                </Field>
              </>
            )}
            <button className="btn btn-signal btn-block" type="submit" disabled={saving}>Add {addKind === 'admin' ? 'Manager' : addKind === 'member' ? 'Member' : addKind === 'trainer' ? 'Trainer' : 'Staff'}</button>
          </form>
        </Modal>
      )}

      {confirmAdd && (
        <Modal title="" showCloseButton={false} onClose={() => { setConfirmAdd(false); setPendingAddForm(null); }}>
          <div style={{ padding: '0 24px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 16.5, margin: '0 0 24px', lineHeight: 1.6 }}>
              Are you sure you want to add this user as an {addKind === 'admin' ? 'manager' : addKind === 'member' ? 'member' : addKind === 'trainer' ? 'trainer' : 'staff'}?
            </p>
            {databaseMode && <p style={{ fontSize: 13, color: 'var(--steel)' }}>This creates a gym record. Online access requires a verified invitation.</p>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => { setConfirmAdd(false); setPendingAddForm(null); }}>
                Cancel
              </button>
              <button
                className="btn btn-signal"
                onClick={finalizeAdd}
                disabled={saving}
                style={{ background: 'var(--court)', borderColor: 'var(--court)' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===== Edit modal (role-aware) ===== */}
      {editing && editForm && (
        <Modal title={`Edit ${editing.name}`} onClose={() => { setEditing(null); setEditForm(null); }}>
          <form onSubmit={submitEdit}>
<NameFields value={editForm} onChange={setEditForm} />
            {editing.kind === 'admin' && (
              <>
                <Field label="Email"><TextInput type="email" value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))} /></Field>
                <Field label="Phone"><TextInput value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} /></Field>
                <Field label="Status">
                  <Select value={editForm.status} onChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                    <option>Active</option><option>Inactive</option>
                  </Select>
                </Field>
                {!databaseMode && <Field label="CHANGE ROLE">
                  <Select value={editForm.changeRole} onChange={(v) => setEditForm((f) => ({ ...f, changeRole: v }))}>
                    <option value="admin">Manager</option>
                    <option value="member">Member</option>
                    <option value="staff">Staff</option>
                    <option value="trainer">Trainer</option>
                  </Select>
                </Field>}
              </>
            )}
            {editing.kind === 'member' && (
              <>
                <Field label="Email"><TextInput type="email" value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))} /></Field>
                <Field label="Phone"><TextInput value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} /></Field>
                <Field label="Plan Interest">
                  <Select value={editForm.plan} onChange={(v) => setEditForm((f) => ({ ...f, plan: v }))}>
                    {plans.map(plan => <option key={plan.name}>{plan.name}</option>)}
                  </Select>
                </Field>
                {!databaseMode && <Field label="CHANGE ROLE">
                  <Select value={editForm.changeRole} onChange={(v) => setEditForm((f) => ({ ...f, changeRole: v }))}>
                    <option value="admin">Manager</option>
                    <option value="member">Member</option>
                    <option value="staff">Staff</option>
                    <option value="trainer">Trainer</option>
                  </Select>
                </Field>}
              </>
            )}
            {editing.kind === 'trainer' && (
              <>
                <Field label="Email"><TextInput type="email" value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))} /></Field>
                <Field label="Phone"><TextInput value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} /></Field>
                <Field label="Specialty"><TextInput value={editForm.specialty} onChange={(v) => setEditForm((f) => ({ ...f, specialty: v }))} /></Field>
                <Field label="Certifications"><TextInput value={editForm.certs} onChange={(v) => setEditForm((f) => ({ ...f, certs: v }))} /></Field>
                <Field label="Session Price (₱)"><TextInput type="number" value={editForm.sessionPrice} onChange={(v) => setEditForm((f) => ({ ...f, sessionPrice: v }))} /></Field>
                <Field label="Status">
                  <Select value={editForm.status} onChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                    <option>Active</option><option>On Leave</option><option>Inactive</option>
                  </Select>
                </Field>
                {!databaseMode && <Field label="CHANGE ROLE">
                  <Select value={editForm.changeRole} onChange={(v) => setEditForm((f) => ({ ...f, changeRole: v }))}>
                    <option value="admin">Manager</option>
                    <option value="member">Member</option>
                    <option value="staff">Staff</option>
                    <option value="trainer">Trainer</option>
                  </Select>
                </Field>}
              </>
            )}
            {editing.kind === 'staff' && (
              <>
                <Field label="Email"><TextInput type="email" value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))} /></Field>
                <Field label="Phone"><TextInput value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} /></Field>
                <Field label="Role">
                  <Select value={editForm.role} onChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
                    <option>Front Desk</option><option>Sales</option><option>Manager</option>
                  </Select>
                </Field>
                <Field label="Shift">
                  <Select value={editForm.shift} onChange={(v) => setEditForm((f) => ({ ...f, shift: v }))}>
                    <option>Morning</option><option>Evening</option><option>Night</option>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={editForm.status} onChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                    <option>Active</option><option>On Leave</option><option>Inactive</option>
                  </Select>
                </Field>
                {!databaseMode && <Field label="CHANGE ROLE">
                  <Select value={editForm.changeRole} onChange={(v) => setEditForm((f) => ({ ...f, changeRole: v }))}>
                    <option value="admin">Manager</option>
                    <option value="member">Member</option>
                    <option value="staff">Staff</option>
                    <option value="trainer">Trainer</option>
                  </Select>
                </Field>}
              </>
            )}
            <button className="btn btn-signal btn-block" type="submit" disabled={saving}>Save Changes</button>
          </form>
        </Modal>
      )}
      </>}
    </>
  );
}

export default SuperAdminUsers;
