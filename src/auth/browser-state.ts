const ACCOUNT_MARKER = 'vinathletics.account-id';

export async function clearAccountBrowserState() {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[name];
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith('vinathletics.') || key?.startsWith('vinathletics-')) {
          if (key !== 'vinathletics-theme') storage.removeItem(key);
        }
      }
    } catch { /* Browser storage may be unavailable. */ }
  }
  if ('caches' in window) {
    try {
      const keys = await window.caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('vinathletics'))
        .map((key) => window.caches.delete(key)));
    } catch { /* Cache storage may be unavailable. */ }
  }
}

export async function establishAccountBrowserState(accountId: string) {
  try {
    if (window.localStorage.getItem(ACCOUNT_MARKER) !== accountId) {
      await clearAccountBrowserState();
      window.localStorage.setItem(ACCOUNT_MARKER, accountId);
    }
  } catch { /* Storage may be unavailable; the server remains authoritative. */ }
}

export async function clearFormerAccountBrowserState() {
  try {
    if (window.localStorage.getItem(ACCOUNT_MARKER)) await clearAccountBrowserState();
  } catch { /* Storage may be unavailable. */ }
}
