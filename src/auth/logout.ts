import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { revokeSession } from './sessions';
import { clearSessionCookies, sessionCookiePolicy } from './session-cookie';
import { apiError, hasSameOrigin } from './http';
import { writeAudit } from './audit';

function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Public compatibility with installed NextAuth v4's CSRF cookie protocol.
// Origin-authenticated JSON logout is also used by the application UI.
function validCsrf(request: NextRequest, submitted: unknown) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || typeof submitted !== 'string') return false;
  const name = sessionCookiePolicy().options.secure ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token';
  const [token, hash] = request.cookies.get(name)?.value.split('|') ?? [];
  return Boolean(token && hash && equal(token, submitted)
    && equal(hash, createHash('sha256').update(`${token}${secret}`).digest('hex')));
}

export async function logout(request: NextRequest, requestId: string) {
  let body: Record<string, unknown>;
  try {
    body = request.headers.get('content-type')?.includes('application/json')
      ? await request.json() : Object.fromEntries(await request.formData());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  } catch { return apiError(400, 'INVALID_REQUEST', 'Request body could not be read.', requestId); }
  // An explicitly foreign origin is rejected even with a valid CSRF token.
  if (!(hasSameOrigin(request) || (!request.headers.has('origin')
    && request.headers.get('sec-fetch-site') !== 'cross-site' && validCsrf(request, body.csrfToken)))) {
    try {
      await writeAudit(prisma, { actor: null, action: 'request.origin', target: null, result: 'rejected', requestId });
    } catch { return apiError(503, 'UNAVAILABLE', 'Sign-out is temporarily unavailable. Please retry.', requestId); }
    return apiError(403, 'ORIGIN_REJECTED', 'The request origin could not be verified.', requestId);
  }
  try {
    const name = sessionCookiePolicy().name;
    // Business lookup rejects ambiguous chunks. Logout must still revoke the
    // explicit base credential when stale chunks accompany it, before clearing.
    let token = request.cookies.get(name)?.value;
    if (!token) {
      const chunks = request.cookies.getAll().filter((cookie) => cookie.name.startsWith(`${name}.`))
        .sort((a, b) => Number(a.name.slice(name.length + 1)) - Number(b.name.slice(name.length + 1)));
      if (chunks.some((cookie, index) => cookie.name !== `${name}.${index}`)) {
        await writeAudit(prisma, { actor: null, action: 'session.revoked', target: null, result: 'rejected', requestId });
        return apiError(400, 'INVALID_SESSION_COOKIE', 'The session cookie could not be read.', requestId);
      }
      token = chunks.map((cookie) => cookie.value).join('');
    }
    if (token) await prisma.$transaction((tx) => revokeSession(tx, token));
    const base = new URL(process.env.NEXTAUTH_URL ?? request.url);
    let destination = base.origin;
    if (typeof body.callbackUrl === 'string') {
      try {
        const candidate = new URL(body.callbackUrl, base);
        if (candidate.origin === base.origin) destination = candidate.href === `${base.origin}/` ? base.origin : candidate.href;
      } catch { /* Use canonical same-origin destination. */ }
    }
    const response = body.json === 'true' || request.headers.get('content-type')?.includes('application/json')
      ? NextResponse.json({ url: destination }) : NextResponse.redirect(destination, 303);
    response.headers.set('x-request-id', requestId);
    response.headers.set('cache-control', 'private, no-store');
    // Clear cookies only after the revocation and its audit commit together.
    clearSessionCookies(request, response);
    return response;
  } catch {
    try {
      await writeAudit(prisma, { actor: null, action: 'session.revoked', target: null, result: 'failed', requestId });
    } catch { console.error('Sign-out audit storage is unavailable.'); }
    return apiError(503, 'UNAVAILABLE', 'Your session could not be revoked. Please retry sign-out.', requestId);
  }
}
