import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearAccountBrowserState, clearFormerAccountBrowserState, establishAccountBrowserState } from '../src/auth/browser-state.ts';

function storage(entries) {
  const values = new Map(Object.entries(entries));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test('identity changes and logout clear Account browser state while preserving theme', async () => {
  const deleted = [];
  globalThis.window = {
    localStorage: storage({
      'vinathletics.account-id': 'previous-account',
      'vinathletics.qrDestinations': 'private gym data',
      'vinathletics-2fa:member': 'demo-only assurance',
      'vinathletics-theme': 'light',
    }),
    sessionStorage: storage({ 'vinathletics.member-profile': 'previous member' }),
    caches: {
      async keys() { return ['vinathletics-account-cache', 'unrelated-cache']; },
      async delete(key) { deleted.push(key); return true; },
    },
  };
  try {
    await establishAccountBrowserState('new-account');
    assert.equal(window.localStorage.getItem('vinathletics.account-id'), 'new-account');
    assert.equal(window.localStorage.getItem('vinathletics.qrDestinations'), null);
    assert.equal(window.localStorage.getItem('vinathletics-2fa:member'), null);
    assert.equal(window.sessionStorage.getItem('vinathletics.member-profile'), null);
    assert.equal(window.localStorage.getItem('vinathletics-theme'), 'light');
    assert.deepEqual(deleted, ['vinathletics-account-cache']);
    await clearFormerAccountBrowserState();
    assert.equal(window.localStorage.getItem('vinathletics.account-id'), null);
    assert.equal(window.localStorage.getItem('vinathletics-theme'), 'light');
    window.localStorage.setItem('vinathletics.qrDestinations', 'demo data');
    await clearFormerAccountBrowserState();
    assert.equal(window.localStorage.getItem('vinathletics.qrDestinations'), 'demo data');
    await clearAccountBrowserState();
    assert.equal(window.localStorage.getItem('vinathletics.account-id'), null);
    assert.equal(window.localStorage.getItem('vinathletics-theme'), 'light');
  } finally { delete globalThis.window; }
});
