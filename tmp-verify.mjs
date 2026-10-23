// End-to-end HTTP proof of the admin wiring against the running dev server.
// Business routes trust only the DB-backed next-auth.session-token cookie, so
// the session issued by tmp-seed.mjs is loaded from tmp-seed.json.
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3001';
const ORIGIN = 'http://localhost:3001';
const stamp = process.env.VERIFY_STAMP || String(Date.now());
const jar = new Map();
const results = [];

const seed = JSON.parse(readFileSync('tmp-seed.json', 'utf8'));
jar.set('next-auth.session-token', seed.sessionToken);

function absorb(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (value !== '') jar.set(name, value);
  }
}

function cookieHeader() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function call(label, method, path, body) {
  const headers = { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const c = cookieHeader();
  if (c) headers.Cookie = c;
  let status = 0;
  let text = '';
  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    status = res.status;
    absorb(res);
    text = await res.text();
  } catch (err) {
    results.push({ label, method, path, status: 0, error: String((err && err.message) || err) });
    return null;
  }
  let payload = null;
  try { payload = JSON.parse(text); } catch { payload = text.slice(0, 240); }
  results.push({ label, method, path, status, payload });
  return { status, payload };
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

const report = { stamp, base: BASE, steps: results, summary: {} };

const first = await call('trainers GET (probe)', 'GET', '/api/trainers');
if (!first || first.status !== 200) {
  report.summary = { ok: false, reason: 'session did not authorize', status: first && first.status,
    payload: first && first.payload };
  writeFileSync('tmp-verify.json', JSON.stringify(report, null, 2));
  console.log('WROTE tmp-verify.json (probe failed)');
  process.exit(0);
}

// --- Trainers ----------------------------------------------------------
const trainerEmail = `verify.trainer.${stamp}@vinathletics.gym`;
const trainerCreate = await call('trainers POST', 'POST', '/api/trainers', {
  name: 'Verify Trainer', email: trainerEmail, specialty: 'Strength',
  certifications: ['CSCS'], sessionRate: 90000, bio: 'wiring proof',
});
const trainerRow = trainerCreate && trainerCreate.payload && trainerCreate.payload.trainer;
report.summary.trainerCreated = trainerRow
  ? pick(trainerRow, ['id', 'displayNumber', 'specialty', 'sessionRate', 'status', 'certifications'])
  : null;

if (trainerRow) {
  const patched = await call('trainers PATCH (by displayNumber)', 'PATCH',
    `/api/trainers/${encodeURIComponent(trainerRow.displayNumber)}`, {
      name: 'Verify Trainer Renamed', specialty: 'Mobility', sessionRate: 95000,
      status: 'Active', certifications: ['CSCS', 'FRC'],
    });
  report.summary.trainerPatched = patched && patched.payload
    ? pick(patched.payload.trainer || {}, ['specialty', 'sessionRate', 'status', 'certifications', 'user'])
    : null;
}
await call('trainers GET (after create/patch)', 'GET', '/api/trainers');

// --- Staff -------------------------------------------------------------
const staffEmail = `verify.staff.${stamp}@vinathletics.gym`;
const staffCreate = await call('staff POST', 'POST', '/api/staff', {
  name: 'Verify Staff', email: staffEmail, jobRole: 'Front Desk', shift: 'Morning',
  phone: '+63 900 000 0000',
});
const staffRow = staffCreate && staffCreate.payload && staffCreate.payload.staff;
report.summary.staffCreated = staffRow
  ? pick(staffRow, ['id', 'displayNumber', 'jobRole', 'shift', 'status'])
  : null;

if (staffRow) {
  const patched = await call('staff PATCH (by displayNumber)', 'PATCH',
    `/api/staff/${encodeURIComponent(staffRow.displayNumber)}`, {
      name: 'Verify Staff Renamed', shift: 'Evening', status: 'On Leave',
    });
  report.summary.staffPatched = patched && patched.payload
    ? pick(patched.payload.staff || {}, ['jobRole', 'shift', 'status', 'user'])
    : null;
  await call('staff DELETE (soft)', 'DELETE', `/api/staff/${encodeURIComponent(staffRow.displayNumber)}`);
}
await call('staff GET (after)', 'GET', '/api/staff?limit=200');

// --- Booking -----------------------------------------------------------
const membersList = await call('members GET', 'GET', '/api/members?limit=5');
let memberDisplay = null;
if (membersList && membersList.payload) {
  const arr = membersList.payload.members || membersList.payload.data || [];
  if (arr.length > 0) memberDisplay = arr[0].displayNumber || arr[0].id;
}
report.summary.memberSample = memberDisplay;

if (memberDisplay) {
  const detail = await call('member GET (detail)', 'GET', `/api/members/${encodeURIComponent(memberDisplay)}`);
  const member = detail && detail.payload && detail.payload.member;
  report.summary.memberGymUserId = member ? member.gymUserId : null;
  if (member && trainerRow) {
    await call('bookings POST (admin, no availability row)', 'POST', '/api/bookings', {
      memberId: member.gymUserId,
      trainerId: trainerRow.displayNumber,
      date: '2026-12-01',
      startTime: '10:00',
      endTime: '11:00',
      notes: 'wiring proof',
    });
  }
}
await call('bookings GET', 'GET', '/api/bookings?limit=5');

// --- QR destinations ---------------------------------------------------
await call('qr GET (before)', 'GET', '/api/qr-destinations');
const qrCreate = await call('qr POST', 'POST', '/api/qr-destinations', {
  label: 'Verify Link', url: 'https://www.facebook.com/verify-wiring',
});
const qrRow = qrCreate && qrCreate.payload && qrCreate.payload.destination;
report.summary.qrCreated = qrRow ? pick(qrRow, ['id', 'label', 'url', 'sortOrder']) : null;

if (qrRow) {
  await call('qr PATCH (label+url)', 'PATCH', '/api/qr-destinations', {
    links: [{ id: qrRow.id, label: 'Verify Link Renamed', url: 'https://example.com/verify-wiring' }],
  });
  const afterPatch = await call('qr GET (after patch)', 'GET', '/api/qr-destinations');
  const patchedRow = afterPatch && afterPatch.payload && Array.isArray(afterPatch.payload.destinations)
    ? afterPatch.payload.destinations.find((d) => d.id === qrRow.id)
    : null;
  report.summary.qrPatched = patchedRow ? pick(patchedRow, ['label', 'url']) : null;
  await call('qr DELETE', 'DELETE', `/api/qr-destinations?id=${encodeURIComponent(qrRow.id)}`);
}
await call('qr GET (after delete)', 'GET', '/api/qr-destinations');

// --- Cleanup: soft-delete the trainer we created ------------------------
if (trainerRow) {
  await call('trainers DELETE (cleanup)', 'DELETE', `/api/trainers/${encodeURIComponent(trainerRow.displayNumber)}`);
}

const failures = results.filter((r) => r.status === 0 || r.status >= 500 || r.status === 401 || r.status === 403);
report.summary.ok = failures.length === 0;
report.summary.statuses = results.map((r) => `${r.status} ${r.label}`);
report.summary.failures = failures.map((f) => ({ label: f.label, status: f.status, payload: f.payload, error: f.error }));
writeFileSync('tmp-verify.json', JSON.stringify(report, null, 2));
console.log('WROTE tmp-verify.json');
