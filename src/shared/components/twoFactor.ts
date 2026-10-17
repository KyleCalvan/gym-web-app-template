import type { Role } from '../../types.ts';

const STORAGE_KEY_PREFIX = 'vinathletics-2fa:';
const EMAIL_KEY_PREFIX = 'vinathletics-2fa-email:';

export function isTwoFactorEnabled(role: Role): boolean {
  return window.localStorage.getItem(STORAGE_KEY_PREFIX + role) === 'true';
}

export function getTwoFactorEmail(role: Role): string | null {
  return window.localStorage.getItem(EMAIL_KEY_PREFIX + role);
}

export function setTwoFactorEnabled(role: Role, enabled: boolean, email?: string): void {
  if (enabled && email) window.localStorage.setItem(EMAIL_KEY_PREFIX + role, email);
  if (!enabled) window.localStorage.removeItem(EMAIL_KEY_PREFIX + role);
  window.localStorage.setItem(STORAGE_KEY_PREFIX + role, String(enabled));
}
