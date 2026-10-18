import assert from 'node:assert/strict';
import test from 'node:test';
import { getAssignedRoles } from '../src/auth/roles.ts';

const originalAssignments = process.env.ROLE_ASSIGNMENTS;
const originalAdmins = process.env.ADMIN_EMAILS;

function restoreEnvironment() {
  if (originalAssignments === undefined) delete process.env.ROLE_ASSIGNMENTS;
  else process.env.ROLE_ASSIGNMENTS = originalAssignments;
  if (originalAdmins === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdmins;
}

test('defaults authenticated accounts to member only', () => {
  delete process.env.ROLE_ASSIGNMENTS;
  delete process.env.ADMIN_EMAILS;
  assert.deepEqual(getAssignedRoles('member@example.com'), ['member']);
  restoreEnvironment();
});

test('uses configured roles for a matching normalized email', () => {
  process.env.ROLE_ASSIGNMENTS = JSON.stringify({
    'Coach@Example.com': ['member', 'trainer'],
  });
  process.env.ADMIN_EMAILS = 'coach@example.com';
  assert.deepEqual(getAssignedRoles(' COACH@example.com '), ['member', 'trainer']);
  restoreEnvironment();
});

test('grants admin only through the server admin allowlist when no explicit assignment exists', () => {
  delete process.env.ROLE_ASSIGNMENTS;
  process.env.ADMIN_EMAILS = 'admin@example.com';
  assert.deepEqual(getAssignedRoles('admin@example.com'), ['member', 'admin']);
  assert.deepEqual(getAssignedRoles('other@example.com'), ['member']);
  restoreEnvironment();
});

test('rejects malformed role assignment configuration and unknown roles', () => {
  process.env.ROLE_ASSIGNMENTS = '{bad json';
  assert.throws(() => getAssignedRoles('member@example.com'), /ROLE_ASSIGNMENTS must be a JSON object/);

  process.env.ROLE_ASSIGNMENTS = JSON.stringify({ 'user@example.com': ['owner'] });
  assert.throws(() => getAssignedRoles('user@example.com'), /invalid role list/);
  restoreEnvironment();
});
