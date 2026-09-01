// @ts-nocheck
import { useState, useMemo } from 'react';
import { Badge, Table, Modal, Field, TextInput, Select, TabbedCard, Avatar } from '../shared';
import { INITIALS } from '../data.ts';

// Normalized user shape used in the unified table.
function buildUsers({ admins, members, trainers, staff }) {
  const out = [];
  for (const a of admins)    if (!a.deletedAt) out.push({ kind: 'admin',   id: a.id, name: a.name,   email: a.email,                              status: a.status,   label: a.status === 'Active' ? 'Admin' : 'Inactive Admin' });
  for (const m of members)   if (!m.deletedAt) out.push({ kind: 'member',  id: m.id, name: m.name,   email: m.email, phone: m.phone, plan: m.plan, status: m.status, label: m.plan });
  for (const t of trainers)  if (!t.deletedAt) out.push({ kind: 'trainer', id: t.id, name: t.name,   email: '—',          status: t.status, label: t.specialty });
  for (const s of staff)     if (!s.deletedAt) out.push({ kind: 'staff',   id: s.id, name: s.name,   email: s.email, phone: s.phone, status: s.status, label: s.role });
  return out;
}

function SuperAdminUsers({
  admins, setAdmins,
  members, setMembers,
  trainers, setTrainers,
  staff, setStaff,
  today, toast, addAudit,
}) {
  const [q, setQ] = useState('');
  const [kindF, setKindF] = useState('all');
  const [statusF, setStatusF] = useState('All');

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [adding, setAdding] = useState(false);
  const [addKind, setAddKind] = useState('admin');
  const [addForm, setAddForm] = useState({
    firstName: '', lastName: '', middleName: '', email: '', phone: '', plan: 'Premium',
    specialty: 'General', certs: '', sessionPrice: '900',
    role: 'Front Desk', shift: 'Morning',
    status: 'Active',
  });

  const [pendingRemove, setPendingRemove] = useState(null);
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
    const names = u.name.split(' ');
    const firstName = names[0] || '';
    const lastName = names[names.length - 1] || '';
    const middleName = names.length > 2 ? names.slice(1, -1).join(' ') : '';

    if (u.kind === 'admin')   setEditForm({ firstName, lastName, middleName, email: u.email, phone: u.phone || '', status: u.status, changeRole: '', resetPassword: false });
    if (u.kind === 'member')  setEditForm({ firstName, lastName, middleName, email: u.email, phone: u.phone, plan: u.plan, changeRole: '', resetPassword: false });
    if (u.kind === 'trainer') setEditForm({ firstName, lastName, middleName, email: u.email || '', phone: u.phone || '', specialty: u.label, certs: trainers.find((t) => t.id === u.id)?.certs || '', sessionPrice: String(trainers.find((t) => t.id === u.id)?.sessionPrice || 900), status: u.status, changeRole: '', resetPassword: false });
    if (u.kind === 'staff')   setEditForm({ ...staff.find((s) => s.id === u.id), firstName, lastName, middleName, changeRole: '', resetPassword: false });
  };

  const submitEdit = (e) => {
    e.preventDefault();
    if (!editing || !editForm) return;
    const fullName = `${editForm.lastName} ${editForm.firstName} ${editForm.middleName}`.trim().replace(/\s+/g, ' ');
    const password = editForm.resetPassword ? editForm.lastName : undefined;
    if (editing.kind === 'admin') {
      setAdmins((prev) => prev.map((a) => a.id === editing.id ? { ...a, name: fullName, ...editForm, password, firstName: null, lastName: null, middleName: null } : a));
      addAudit?.('info', 'Admin updated', `${fullName} (${editing.id})`);
      toast('Admin updated — ' + fullName);
    } else if (editing.kind === 'member') {
      setMembers((prev) => prev.map((m) => m.id === editing.id ? { ...m, name: fullName, ...editForm, password, firstName: null, lastName: null, middleName: null } : m));
      addAudit?.('info', 'Member updated', `${fullName} (${editing.id})`);
      toast('Member updated — ' + fullName);
    } else if (editing.kind === 'trainer') {
      setTrainers((prev) => prev.map((t) => t.id === editing.id ? { ...t, name: fullName, email: editForm.email, phone: editForm.phone, specialty: editForm.specialty, certs: editForm.certs, sessionPrice: Number(editForm.sessionPrice) || 900, status: editForm.status, password } : t));
      addAudit?.('info', 'Trainer updated', `${fullName} (${editing.id})`);
      toast('Trainer updated — ' + fullName);
    } else if (editing.kind === 'staff') {
      setStaff((prev) => prev.map((s) => s.id === editing.id ? { ...s, name: fullName, ...editForm, password, firstName: null, lastName: null, middleName: null } : s));
      addAudit?.('info', 'Staff updated', `${fullName} (${editing.id})`);
      toast('Staff updated — ' + fullName);
    }
    setEditing(null);
    setEditForm(null);
  };

  const submitAdd = (e) => {
    e.preventDefault();
    const fullName = `${addForm.lastName} ${addForm.firstName} ${addForm.middleName}`.trim().replace(/\s+/g, ' ');
    if (!fullName) { toast('Name is required'); return; }
    setPendingAddForm({ ...addForm, name: fullName });
    setConfirmAdd(true);
  };

  const finalizeAdd = () => {
    if (!pendingAddForm) return;
    const form = pendingAddForm;
    if (addKind === 'admin') {
      const id = 'SA-' + String(admins.length + 1).padStart(2, '0');
      setAdmins((prev) => [...prev, { id, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), status: form.status, createdAt: today }]);
      addAudit?.('info', 'Admin registered', `${form.name.trim()} (${id})`);
      toast('Admin added — ' + form.name);
    } else if (addKind === 'member') {
      const id = 'M-' + (1042 + members.length);
      setMembers((prev) => [...prev, { id, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), plan: form.plan, status: 'Active', joined: today }]);
      addAudit?.('info', 'Member registered', `${form.name.trim()} (${id})`);
      toast('Member added — ' + form.name);
    } else if (addKind === 'trainer') {
      const id = 'T-0' + (trainers.length + 1);
      setTrainers((prev) => [...prev, { id, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), specialty: form.specialty || 'General', certs: form.certs || '', rating: 0, sessionsWeek: 0, status: form.status, sessionPrice: Number(form.sessionPrice) || 900, reviews: [] }]);
      addAudit?.('info', 'Trainer added', `${form.name.trim()} (${id})`);
      toast('Trainer added — ' + form.name);
    } else if (addKind === 'staff') {
      const id = 'S-' + String(staff.length + 1).padStart(2, '0');
      setStaff((prev) => [...prev, { id, name: form.name.trim(), role: form.role, shift: form.shift, status: form.status, email: form.email.trim(), phone: form.phone.trim(), hireDate: today }]);
      addAudit?.('info', 'Staff registered', `${form.name.trim()} (${id})`);
      toast('Staff added — ' + form.name);
    }
    setAdding(false);
    setConfirmAdd(false);
    setPendingAddForm(null);
    setAddForm({ name: '', email: '', phone: '', plan: 'Premium', specialty: 'General', certs: '', sessionPrice: '900', role: 'Front Desk', shift: 'Morning', status: 'Active' });
  };

  // Removal: soft-delete everyone via deletedAt; super admin can restore or permanently delete from Archive.
  const applyRemove = () => {
    if (!pendingRemove) return;
    const u = pendingRemove;
    const now = new Date().toISOString();
    if (u.kind === 'admin') {
      setAdmins((prev) => prev.map((a) => a.id === u.id ? { ...a, deletedAt: now } : a));
      addAudit?.('warn', 'Admin removed (soft)', `${u.name} (${u.id})`);
      toast('Admin removed — ' + u.name);
    } else if (u.kind === 'member') {
      setMembers((prev) => prev.map((m) => m.id === u.id ? { ...m, deletedAt: now } : m));
      addAudit?.('warn', 'Member removed (soft)', `${u.name} (${u.id})`);
      toast('Member removed — ' + u.name);
    } else if (u.kind === 'trainer') {
      setTrainers((prev) => prev.map((t) => t.id === u.id ? { ...t, deletedAt: now } : t));
      addAudit?.('warn', 'Trainer removed (soft)', `${u.name} (${u.id})`);
      toast('Trainer removed — ' + u.name);
    } else if (u.kind === 'staff') {
      setStaff((prev) => prev.map((s) => s.id === u.id ? { ...s, deletedAt: now } : s));
      addAudit?.('warn', 'Staff removed (soft)', `${u.name} (${u.id})`);
      toast('Staff removed — ' + u.name);
    }
    setPendingRemove(null);
  };

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="stat-tile"><div className="eyebrow">Admins</div><div className="num">{counts.admin}</div></div>
        <div className="stat-tile"><div className="eyebrow">Members</div><div className="num">{counts.member}</div></div>
        <div className="stat-tile"><div className="eyebrow">Active Trainers</div><div className="num">{counts.trainer}</div></div>
        <div className="stat-tile"><div className="eyebrow">Staff</div><div className="num">{counts.staff}</div></div>
      </div>

      <TabbedCard
        label="System"
        title="All Users"
        right={
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-outline btn-sm" onClick={() => { setAddKind('admin'); setAdding(true); }}>+ Add Admin</button>
            <button className="btn btn-signal btn-sm" onClick={() => { setAddKind('member'); setAdding(true); }}>+ Register Member</button>
            <button className="btn btn-outline btn-sm" onClick={() => { setAddKind('trainer'); setAdding(true); }}>+ Add Trainer</button>
            <button className="btn btn-outline btn-sm" onClick={() => { setAddKind('staff'); setAdding(true); }}>+ Add Staff</button>
          </div>
        }
      >
        <div className="search-row">
          <TextInput placeholder="Search by name or email…" value={q} onChange={setQ} />
          <Select value={kindF} onChange={setKindF} style={{ maxWidth: 140 }}>
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="member">Members</option>
            <option value="trainer">Trainers</option>
            <option value="staff">Staff</option>
          </Select>
          <Select value={statusF} onChange={setStatusF} style={{ maxWidth: 160 }}>
            {['All','Active','Inactive','On Leave','Frozen','Expiring','Expired'].map((s) => <option key={s}>{s}</option>)}
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
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--steel)' }}>{u.id}</div>
              </td>
              <td>
                <div style={{ fontSize: 12.5 }}>{u.email}</div>
                {u.phone && <div className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>{u.phone}</div>}
              </td>
              <td>
                <span style={{ textTransform: 'capitalize' }}>{u.kind}</span>
                <div style={{ fontSize: 11.5, color: 'var(--steel)' }}>{u.label}</div>
              </td>
              <td><Badge status={u.status} /></td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => startEdit(u)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPendingRemove(u)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      </TabbedCard>

      {/* ===== Add modal ===== */}
      {adding && (
        <Modal title={`Add ${addKind === 'admin' ? 'Admin' : addKind === 'member' ? 'Member' : addKind === 'trainer' ? 'Trainer' : 'Staff'}`} onClose={() => setAdding(false)}>
          <form onSubmit={submitAdd}>
            {addKind === 'admin' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  <Field label="LAST NAME"><TextInput required value={addForm.lastName} onChange={(v) => setAddForm((f) => ({ ...f, lastName: v }))} /></Field>
                  <Field label="FIRST NAME"><TextInput required value={addForm.firstName} onChange={(v) => setAddForm((f) => ({ ...f, firstName: v }))} /></Field>
                  <Field label="MIDDLE NAME"><TextInput value={addForm.middleName} onChange={(v) => setAddForm((f) => ({ ...f, middleName: v }))} /></Field>
                </div>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  <Field label="LAST NAME"><TextInput required value={addForm.lastName} onChange={(v) => setAddForm((f) => ({ ...f, lastName: v }))} /></Field>
                  <Field label="FIRST NAME"><TextInput required value={addForm.firstName} onChange={(v) => setAddForm((f) => ({ ...f, firstName: v }))} /></Field>
                  <Field label="MIDDLE NAME"><TextInput value={addForm.middleName} onChange={(v) => setAddForm((f) => ({ ...f, middleName: v }))} /></Field>
                </div>
                <Field label="Email"><TextInput type="email" required value={addForm.email} onChange={(v) => setAddForm((f) => ({ ...f, email: v }))} /></Field>
                <Field label="Phone"><TextInput value={addForm.phone} onChange={(v) => setAddForm((f) => ({ ...f, phone: v }))} placeholder="+63 9XX XXX XXXX" /></Field>
                <Field label="Plan">
                  <Select value={addForm.plan} onChange={(v) => setAddForm((f) => ({ ...f, plan: v }))}>
                    <option>Basic</option><option>Premium</option><option>Elite</option>
                  </Select>
                </Field>
              </>
            )}
            {addKind === 'trainer' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  <Field label="LAST NAME"><TextInput required value={addForm.lastName} onChange={(v) => setAddForm((f) => ({ ...f, lastName: v }))} /></Field>
                  <Field label="FIRST NAME"><TextInput required value={addForm.firstName} onChange={(v) => setAddForm((f) => ({ ...f, firstName: v }))} /></Field>
                  <Field label="MIDDLE NAME"><TextInput value={addForm.middleName} onChange={(v) => setAddForm((f) => ({ ...f, middleName: v }))} /></Field>
                </div>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  <Field label="LAST NAME"><TextInput required value={addForm.lastName} onChange={(v) => setAddForm((f) => ({ ...f, lastName: v }))} /></Field>
                  <Field label="FIRST NAME"><TextInput required value={addForm.firstName} onChange={(v) => setAddForm((f) => ({ ...f, firstName: v }))} /></Field>
                  <Field label="MIDDLE NAME"><TextInput value={addForm.middleName} onChange={(v) => setAddForm((f) => ({ ...f, middleName: v }))} /></Field>
                </div>
                <Field label="Email"><TextInput type="email" value={addForm.email} onChange={(v) => setAddForm((f) => ({ ...f, email: v }))} placeholder="name@vinathletics.gym" /></Field>
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
            <button className="btn btn-signal btn-block" type="submit">Add {addKind === 'admin' ? 'Admin' : addKind === 'member' ? 'Member' : addKind === 'trainer' ? 'Trainer' : 'Staff'}</button>
          </form>
        </Modal>
      )}

      {confirmAdd && (
        <Modal title="" showCloseButton={false} onClose={() => { setConfirmAdd(false); setPendingAddForm(null); }}>
          <div style={{ padding: '0 24px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, margin: '0 0 24px', lineHeight: 1.6 }}>
              Are you sure you want to add this user as an {addKind === 'admin' ? 'admin' : addKind === 'member' ? 'member' : addKind === 'trainer' ? 'trainer' : 'staff'}?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => { setConfirmAdd(false); setPendingAddForm(null); }}>
                Cancel
              </button>
              <button
                className="btn btn-signal"
                onClick={finalizeAdd}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              <Field label="LAST NAME"><TextInput required value={editForm.lastName} onChange={(v) => setEditForm((f) => ({ ...f, lastName: v }))} /></Field>
              <Field label="FIRST NAME"><TextInput required value={editForm.firstName} onChange={(v) => setEditForm((f) => ({ ...f, firstName: v }))} /></Field>
              <Field label="MIDDLE NAME"><TextInput value={editForm.middleName} onChange={(v) => setEditForm((f) => ({ ...f, middleName: v }))} /></Field>
            </div>
            {editing.kind === 'admin' && (
              <>
                <Field label="Email"><TextInput type="email" value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))} /></Field>
                <Field label="Phone"><TextInput value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} /></Field>
                <Field label="Status">
                  <Select value={editForm.status} onChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                    <option>Active</option><option>Inactive</option>
                  </Select>
                </Field>
                <Field label="CHANGE ROLE">
                  <Select value={editForm.changeRole} onChange={(v) => setEditForm((f) => ({ ...f, changeRole: v }))}>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="staff">Staff</option>
                    <option value="trainer">Trainer</option>
                  </Select>
                </Field>
              </>
            )}
            {editing.kind === 'member' && (
              <>
                <Field label="Email"><TextInput type="email" value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))} /></Field>
                <Field label="Phone"><TextInput value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} /></Field>
                <Field label="Plan">
                  <Select value={editForm.plan} onChange={(v) => setEditForm((f) => ({ ...f, plan: v }))}>
                    <option>Basic</option><option>Premium</option><option>Elite</option>
                  </Select>
                </Field>
                <Field label="CHANGE ROLE">
                  <Select value={editForm.changeRole} onChange={(v) => setEditForm((f) => ({ ...f, changeRole: v }))}>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="staff">Staff</option>
                    <option value="trainer">Trainer</option>
                  </Select>
                </Field>
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
                <Field label="CHANGE ROLE">
                  <Select value={editForm.changeRole} onChange={(v) => setEditForm((f) => ({ ...f, changeRole: v }))}>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="staff">Staff</option>
                    <option value="trainer">Trainer</option>
                  </Select>
                </Field>
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
                <Field label="CHANGE ROLE">
                  <Select value={editForm.changeRole} onChange={(v) => setEditForm((f) => ({ ...f, changeRole: v }))}>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="staff">Staff</option>
                    <option value="trainer">Trainer</option>
                  </Select>
                </Field>
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 16, fontSize: 13, color: 'var(--steel)' }}>
              <input
                type="checkbox"
                style={{ cursor: 'pointer' }}
                checked={editForm.resetPassword}
                onChange={(e) => setEditForm((f) => ({ ...f, resetPassword: e.target.checked }))}
              />
              <span style={{ cursor: 'pointer' }} onClick={() => toast('Password reset link sent to ' + (editForm.email || 'user'))}>
                Forgot Password
              </span>
            </div>
            <button className="btn btn-signal btn-block" type="submit">Save Changes</button>
          </form>
        </Modal>
      )}

      {/* ===== Remove (soft-delete) confirmation ===== */}
      {pendingRemove && (
        <Modal
          title="Remove User?"
          showCloseButton={false}
          onClose={() => setPendingRemove(null)}
        >
          <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 14 }}>
            You're about to remove <b>{pendingRemove.name}</b>. They will be archived and
            hidden from this list. You can restore or permanently delete them from the Archive view.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setPendingRemove(null)}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={applyRemove}>
              Remove
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default SuperAdminUsers;
