
// ---------------------------------------------------------------------------
// Gym-domain HTTP coverage. Accounts are seeded through the same helper the
// session tests use (complete, unrestricted profiles), domain rows are seeded
// deterministically via SQL, and every request carries a matching origin so
// it passes the same origin check production traffic does.
// ---------------------------------------------------------------------------

async function seedGymAccount(roles = ['member', 'admin']) {
  const accountId = await seedSessionAccount({ roles });
  const { rows: [auth] } = await withDatabaseClient(database.env, (client) =>
    client.query('SELECT "gymUserId" FROM "AuthUser" WHERE "id" = $1', [accountId]));
  const { cookie } = await issueSession(accountId);
  return { accountId, gymUserId: auth.gymUserId, cookie };
}

async function seedGymDomain(memberGymUserId, trainerGymUserId) {
  await withDatabaseClient(database.env, (client) => client.query(`
    INSERT INTO "MemberProfile" ("id", "gymUserId", "displayNumber", "updatedAt")
      VALUES ('gm-member', $1, 'M-00042', NOW()) ON CONFLICT DO NOTHING;
    INSERT INTO "TrainerProfile" ("id", "gymUserId", "displayNumber", "sessionRate", "updatedAt")
      VALUES ('gm-trainer', $2, 'T-00041', 50000, NOW()) ON CONFLICT DO NOTHING;
    INSERT INTO "TrainerAvailability" ("id", "trainerId", "date", "startTime", "endTime", "status", "updatedAt")
      VALUES ('gm-avail-1', 'gm-trainer', '2026-11-02', '09:00', '10:00', 'available', NOW()) ON CONFLICT DO NOTHING;
    INSERT INTO "Promotion" ("id", "title", "code", "discountType", "discountValue", "validFrom", "validUntil", "status", "updatedAt")
      VALUES ('gm-promo-1', 'Grand Opening', 'GRANDOPEN', 'Percentage', 10, '2026-01-01', '2099-01-01', 'Draft', NOW()) ON CONFLICT DO NOTHING;
  `, [memberGymUserId, trainerGymUserId]));
}

async function gymRequest(path, cookie, { method = 'GET', body } = {}) {
  return fetch(`${application.url}${path}`, {
    method,
    headers: { origin: application.url, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test('gym domain member profiles are readable, patchable, and admin-deletable over HTTP', async () => {
  const operator = await seedGymAccount(['member', 'admin']);
  const plainMember = await seedGymAccount(['member']);
  await seedGymDomain(operator.gymUserId, plainMember.gymUserId);

  const unauthenticated = await gymRequest('/api/members/gm-member', null);
  assert.equal(unauthenticated.status, 401);
  assert.equal(typeof (await unauthenticated.json()).requestId, 'string');

  const read = await gymRequest('/api/members/gm-member', operator.cookie);
  assert.equal(read.status, 200, await read.clone().text());
  assert.equal((await read.json()).member.gymUserId, operator.gymUserId);

  const missing = await gymRequest('/api/members/does-not-exist', operator.cookie);
  assert.equal(missing.status, 404);

  const patched = await gymRequest('/api/members/gm-member', operator.cookie, {
    method: 'PATCH', body: { phone: '09170000000', emergencyContactName: 'Fixture Contact' },
  });
  assert.equal(patched.status, 200, await patched.clone().text());
  assert.equal((await patched.json()).member.phone, '09170000000');

  const empty = await gymRequest('/api/members/gm-member', operator.cookie, { method: 'PATCH', body: {} });
  assert.equal(empty.status, 400);

  const forbidden = await gymRequest('/api/members/gm-member', plainMember.cookie, { method: 'DELETE' });
  assert.equal(forbidden.status, 403);

  const deleted = await gymRequest('/api/members/gm-member', operator.cookie, { method: 'DELETE' });
  assert.equal(deleted.status, 200, await deleted.clone().text());
  assert.ok((await deleted.json()).member.deletedAt);
});

test('check-ins enforce one per member per business day and audit the write', async () => {
  const operator = await seedGymAccount(['member', 'admin']);
  await seedGymDomain(operator.gymUserId, operator.gymUserId);

  const unauthenticated = await gymRequest('/api/checkins', null, { method: 'POST', body: { memberId: operator.gymUserId } });
  assert.equal(unauthenticated.status, 401);

  const invalid = await gymRequest('/api/checkins', operator.cookie, { method: 'POST', body: {} });
  assert.equal(invalid.status, 400);

  const first = await gymRequest('/api/checkins', operator.cookie, { method: 'POST', body: { memberId: operator.gymUserId } });
  assert.equal(first.status, 201, await first.clone().text());
  const created = (await first.json()).checkIn;
  assert.equal(created.memberId, operator.gymUserId);
  assert.equal(created.source, 'Staff');

  const duplicate = await gymRequest('/api/checkins', operator.cookie, { method: 'POST', body: { memberId: operator.gymUserId } });
  assert.equal(duplicate.status, 409);

  const audited = await withDatabaseClient(database.env, async (client) => {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE action = $1 AND target = $2', ['checkin.created', created.id]);
    return rows[0].n;
  });
  assert.equal(audited, 1);
});

test('bookings require a real active trainer and a free slot, then consume the slot', async () => {
  const operator = await seedGymAccount(['member', 'admin']);
  const trainer = await seedGymAccount(['trainer']);
  await seedGymDomain(operator.gymUserId, trainer.gymUserId);

  const unknownTrainer = await gymRequest('/api/bookings', operator.cookie, {
    method: 'POST',
    body: { memberId: operator.gymUserId, trainerId: 'no-such-trainer', date: '2026-11-02', startTime: '09:00', endTime: '10:00' },
  });
  assert.equal(unknownTrainer.status, 404);

  const unavailable = await gymRequest('/api/bookings', operator.cookie, {
    method: 'POST',
    body: { memberId: operator.gymUserId, trainerId: 'gm-trainer', date: '2026-11-02', startTime: '11:00', endTime: '12:00' },
  });
  assert.equal(unavailable.status, 400);

  const created = await gymRequest('/api/bookings', operator.cookie, {
    method: 'POST',
    body: { memberId: operator.gymUserId, trainerId: 'gm-trainer', date: '2026-11-02', startTime: '09:00', endTime: '10:00' },
  });
  assert.equal(created.status, 201, await created.clone().text());
  const booking = (await created.json()).booking;
  assert.equal(booking.memberId, operator.gymUserId);
  assert.equal(booking.trainerId, 'gm-trainer');
  assert.equal(booking.status, 'Pending');

  const status = await withDatabaseClient(database.env, async (client) => {
    const { rows } = await client.query('SELECT status FROM "TrainerAvailability" WHERE id = $1', ['gm-avail-1']);
    return rows[0].status;
  });
  assert.equal(status, 'booked');
});

test('promotion publish is admin-only and claiming is idempotent per member', async () => {
  const operator = await seedGymAccount(['member', 'admin']);
  const plainMember = await seedGymAccount(['member']);
  await seedGymDomain(operator.gymUserId, plainMember.gymUserId);

  const forbidden = await gymRequest('/api/promotions/gm-promo-1', plainMember.cookie, { method: 'PATCH', body: { action: 'publish' } });
  assert.equal(forbidden.status, 403);

  const published = await gymRequest('/api/promotions/gm-promo-1', operator.cookie, { method: 'PATCH', body: { action: 'publish' } });
  assert.equal(published.status, 200, await published.clone().text());
  assert.equal((await published.json()).promotion.status, 'Published');

  const claimByCode = await gymRequest('/api/promotions/grandopen/claim', operator.cookie, { method: 'POST' });
  assert.equal(claimByCode.status, 201, await claimByCode.clone().text());
  const claimed = await claimByCode.json();
  assert.equal(claimed.claim.memberId, operator.gymUserId);
  assert.equal(claimed.promotion.code, 'GRANDOPEN');

  const duplicate = await gymRequest('/api/promotions/gm-promo-1/claim', operator.cookie, { method: 'POST' });
  assert.equal(duplicate.status, 409);

  const redemptions = await withDatabaseClient(database.env, async (client) => {
    const { rows } = await client.query('SELECT redemptions FROM "Promotion" WHERE id = $1', ['gm-promo-1']);
    return rows[0].redemptions;
  });
  assert.equal(redemptions, 1);
});
