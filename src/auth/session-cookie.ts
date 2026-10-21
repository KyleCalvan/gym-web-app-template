import type { NextRequest, NextResponse } from 'next/server';

// The configured canonical URL, never forwarded/request headers, owns policy.
export function sessionCookiePolicy() {
  const secure = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').protocol === 'https:';
  return {
    name: `${secure ? '__Secure-' : ''}next-auth.session-token`,
    options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure },
  };
}

export function requestSessionToken(request: { cookies: {
  get(name: string): { value: string } | undefined; getAll(): { name: string; value: string }[];
} }) {
  const name = sessionCookiePolicy().name;
  // Opaque application tokens fit in one cookie. Reject ambiguous chunked input.
  if (request.cookies.getAll().some((cookie) => cookie.name.startsWith(`${name}.`))) return undefined;
  return request.cookies.get(name)?.value;
}

export function setSessionCookie(response: NextResponse, session: { sessionToken: string; expires: Date }) {
  const policy = sessionCookiePolicy();
  response.cookies.set(policy.name, session.sessionToken, { ...policy.options, expires: session.expires });
}

export function clearSessionCookies(request: NextRequest, response: NextResponse) {
  const names = new Set(['next-auth.session-token', '__Secure-next-auth.session-token']);
  for (const cookie of request.cookies.getAll()) {
    if (/^(?:__Secure-)?next-auth\.session-token(?:\.\d+)?$/.test(cookie.name)) names.add(cookie.name);
  }
  for (const name of names) response.cookies.set(name, '', {
    httpOnly: true, sameSite: 'lax', path: '/', secure: name.startsWith('__Secure-'), maxAge: 0,
  });
}
