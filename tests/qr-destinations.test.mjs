import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQrDestination } from '../src/qrDestinations.ts';

test('QR destinations require secure public HTTPS URLs', () => {
  const destination = (url, id = 'website') => ({ id, label: 'Gym', url });
  assert.equal(validateQrDestination(destination('https://gym.example/')), null);
  assert.match(validateQrDestination(destination('http://gym.example/')), /HTTPS/);
  assert.match(validateQrDestination(destination('javascript:alert(1)')), /complete URL|HTTPS/);
  assert.match(validateQrDestination(destination('https://localhost/')), /public website/);
  assert.match(validateQrDestination(destination('https://192.168.1.10/')), /public website/);
});

test('Facebook QR links must use a Facebook-owned host', () => {
  const destination = (url) => ({ id: 'facebook', label: 'Gym Facebook page', url });
  assert.equal(validateQrDestination(destination('https://www.facebook.com/vinathletics')), null);
  assert.equal(validateQrDestination(destination('https://fb.me/vinathletics')), null);
  assert.match(validateQrDestination(destination('https://facebook.com.attacker.example/page')), /Facebook destination/);
});
