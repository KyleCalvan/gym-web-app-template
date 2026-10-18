import type { QrDestination } from './types.ts';

export const DEFAULT_QR_DESTINATIONS: QrDestination[] = [
  { id: 'facebook', label: 'Gym Facebook page', url: '' },
  { id: 'website', label: 'Gym website', url: '' },
  { id: 'instagram', label: 'Gym Instagram', url: '' },
];

const PRIVATE_IPV4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function validateQrDestination(destination: QrDestination): string | null {
  const value = destination.url.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'Enter a complete URL starting with https://.';
  }

  if (url.protocol !== 'https:') return 'Only secure HTTPS destinations are allowed.';
  if (url.username || url.password) return 'URLs cannot contain embedded usernames or passwords.';
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    PRIVATE_IPV4.test(hostname) ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
    hostname.startsWith('[')
  ) {
    return 'Use a public website address, not a local or private network destination.';
  }

  if (
    destination.id === 'facebook' &&
    !['facebook.com', 'fb.com', 'fb.me', 'fb.watch'].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    )
  ) {
    return 'The Facebook destination must use facebook.com, fb.com, fb.me, or fb.watch.';
  }

  return null;
}
