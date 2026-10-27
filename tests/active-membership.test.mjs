import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasActiveMembership } from '../src/member/activeMembership.ts';

const now = new Date('2026-10-28T12:00:00Z');

test('only an unexpired active or expiring membership blocks another plan', () => {
  assert.equal(hasActiveMembership({ status: 'Active', endsAt: '2026-10-29T00:00:00Z' }, now), true);
  assert.equal(hasActiveMembership({ status: 'Expiring', endsAt: '2026-10-29T00:00:00Z' }, now), true);
  assert.equal(hasActiveMembership({ status: 'Active', endsAt: now }, now), false);
  assert.equal(hasActiveMembership({ status: 'Active', endsAt: '2026-10-27T00:00:00Z' }, now), false);
  assert.equal(hasActiveMembership({ status: 'Expired', endsAt: '2026-10-29T00:00:00Z' }, now), false);
  assert.equal(hasActiveMembership({ status: 'Frozen', endsAt: '2026-10-29T00:00:00Z' }, now), false);
  assert.equal(hasActiveMembership(null, now), false);
});
