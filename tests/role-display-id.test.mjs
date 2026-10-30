import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roleDisplayId } from '../src/shared/roleDisplayId.ts';

test('role display IDs are short, stable and unique across users and roles', () => {
  assert.equal(roleDisplayId('staff', 42), 'ST-1042');
  assert.equal(roleDisplayId('member', 42), 'M-1042');
  assert.equal(roleDisplayId('trainer', 42), 'TR-1042');
  assert.equal(roleDisplayId('admin', 42), 'AD-1042');
  assert.equal(roleDisplayId('superadmin', 42), 'SA-1042');
  assert.notEqual(roleDisplayId('member', 42), roleDisplayId('member', 43));
  assert.notEqual(roleDisplayId('member', 42), roleDisplayId('staff', 42));
});
