import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountPortalRole } from '../src/auth/account-destination';
import type { GymRole } from '../backend/generated/prisma/client';

for (const role of ['member', 'trainer', 'staff', 'admin', 'superadmin'] as GymRole[]) {
  test(`${role} opens its role UI with pending account setup`, () => {
    assert.equal(accountPortalRole({
      account: { status: 'enabled' }, roles: [role], profiles: [{ role, profileId: `${role}-profile` }],
    }), role);
  });
}

test('multiple assigned roles follow the role priority', () => {
  assert.equal(accountPortalRole({ account: { status: 'enabled' },
    roles: ['member', 'staff', 'admin'], profiles: [
      { role: 'member', profileId: 'member-profile' },
      { role: 'staff', profileId: 'staff-profile' },
      { role: 'admin', profileId: 'admin-profile' },
    ],
  }), 'admin');
});

test('disabled and unassigned accounts do not enter a role UI', () => {
  assert.equal(accountPortalRole({ account: { status: 'disabled' },
    roles: ['staff'], profiles: [{ role: 'staff', profileId: 'staff-profile' }],
  }), null);
  assert.equal(accountPortalRole({ account: { status: 'enabled' }, roles: ['staff'], profiles: [] }), null);
});
