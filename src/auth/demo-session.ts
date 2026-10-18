import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Role } from '../types.ts';

export const DEMO_SESSION_COOKIE = 'vinathletics_demo_session';
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const DEVELOPMENT_DEMO_SECRET = 'vinathletics-local-development-demo-session';
const DEMO_USERS: Record<string, { password: string; role: Role; name: string }> = {
  'member@vinathletics.gym': { password: 'member123', role: 'member', name: 'Maria Santos' },
  'staff@vinathletics.gym': { password: 'staff123', role: 'staff', name: 'Clara Lee' },
  'trainer@vinathletics.gym': { password: 'trainer123', role: 'trainer', name: 'James Reyes' },
  'admin@vinathletics.gym': { password: 'admin123', role: 'admin', name: 'Admin One' },
  'superadmin@vinathletics.gym': { password: 'superadmin123', role: 'superadmin', name: 'Juan Dela Cruz' },
};

export interface DemoSession {
  email: string;
  name: string;
  role: Role;
  expiresAt: number;
}

function getSecret(): string {
  const configuredSecret = process.env.DEMO_SESSION_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (configuredSecret) return configuredSecret;
  if (process.env.NODE_ENV !== 'production') return DEVELOPMENT_DEMO_SECRET;
  throw new Error('Set DEMO_SESSION_SECRET or NEXTAUTH_SECRET to sign demo sessions.');
}

function sign(value: string): Buffer {
  return createHmac('sha256', getSecret()).update(value).digest();
}

export function isDemoLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEMO_ACCOUNTS_ENABLED !== 'false';
}

export function authenticateDemoAccount(email: string, password: string): DemoSession | null {
  const normalizedEmail = email.trim().toLowerCase();
  const demoUser = DEMO_USERS[normalizedEmail];
  if (!demoUser || password !== demoUser.password) return null;

  return {
    email: normalizedEmail,
    name: demoUser.name,
    role: demoUser.role,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
}

export function getDemoAccounts(): Array<{ email: string; password: string; role: Role; name: string }> {
  return Object.entries(DEMO_USERS).map(([email, account]) => ({ email, ...account }));
}

export function createDemoSessionToken(session: DemoSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload).toString('base64url')}`;
}

export function readDemoSessionToken(token: string | undefined): DemoSession | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;

  try {
    const expected = sign(payload);
    const received = Buffer.from(signature, 'base64url');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    const value: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object') return null;
    const session = value as Partial<DemoSession>;
    if (typeof session.email !== 'string'
      || typeof session.name !== 'string'
      || typeof session.role !== 'string'
      || !['member', 'staff', 'trainer', 'admin', 'superadmin'].includes(session.role)
      || typeof session.expiresAt !== 'number'
      || session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return session as DemoSession;
  } catch {
    return null;
  }
}

export const DEMO_SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_SECONDS;
