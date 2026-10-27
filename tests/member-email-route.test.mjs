import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadRoute(dependencies) {
  const source = readFileSync(new URL('../app/api/member/email/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    Response, URL, Date, JSON, process: { env: {} },
  });
  return exports;
}

function fixture(session) {
  const calls = [];
  let proof = null;
  const account = { id: 'account-1', email: 'old@example.com', gymUserId: 7, status: 'enabled' };
  const tx = {
    authUser: {
      findFirst: async () => null,
      findUnique: async () => account,
      update: async ({ data }) => { calls.push(['auth', data]); Object.assign(account, data); },
    },
    user: {
      findFirst: async () => null,
      update: async ({ data }) => { calls.push(['gym', data]); },
    },
    authVerificationToken: {
      findFirst: async () => null,
      findUnique: async () => proof,
      deleteMany: async () => { calls.push(['consume']); proof = null; return { count: 1 }; },
    },
  };
  const route = loadRoute({
    'node:crypto': { randomUUID: () => 'request-1' },
    'next/server': { NextResponse: { redirect: url => new Response(null, {
      status: 302, headers: { location: url.toString() },
    }) } },
    '@/src/auth/account': { normalizeEmail: email => email.trim().toLowerCase() },
    '@/src/auth/email-verification': {
      issueEmailVerification: async (_tx, identifier) => { proof = { identifier, expires: new Date(Date.now() + 86_400_000) }; return 'sent-token'; },
      verificationTokenHash: () => 'hashed-token',
    },
    '@/src/auth/http': { hasSameOrigin: () => true },
    '@/src/auth/prisma': { prisma: { $transaction: callback => callback(tx) } },
    '@/src/auth/session-cookie': { requestSessionToken: () => 'session-token' },
    '@/src/auth/sessions': { readSession: async () => session },
    '@/src/auth/verification-mail': {
      verificationMailConfigured: () => true,
      sendEmailChangeVerification: async (email, token) => { calls.push(['mail', email, token]); },
    },
    '@/src/auth/audit': { writeAudit: async () => {} },
  });
  return { route, calls, account, getProof: () => proof };
}

const request = email => ({ json: async () => ({ email }) });

test('member email changes require an unrestricted member session', async () => {
  for (const session of [null, { status: { restricted: true, roles: ['member'] } },
    { status: { restricted: false, roles: ['trainer'] } }]) {
    const { route, calls } = fixture(session);
    const response = await route.POST(request('new@example.com'));
    assert.ok(response.status === 401 || response.status === 403);
    assert.deepEqual(calls, []);
  }
});

test('email only changes after a valid link is consumed', async () => {
  const session = { user: { id: 'account-1', email: 'old@example.com', gymUserId: 7 },
    status: { restricted: false, roles: ['member'] } };
  const { route, calls, account, getProof } = fixture(session);
  const sent = await route.POST(request(' New@Example.com '));
  assert.equal(sent.status, 200);
  assert.equal(account.email, 'old@example.com');
  assert.deepEqual(calls.find(call => call[0] === 'mail'), ['mail', 'new@example.com', 'sent-token']);
  assert.ok(getProof());

  const url = new URL('http://localhost:3000/api/member/email');
  url.searchParams.set('token', 'a'.repeat(43));
  const confirmed = await route.GET({ nextUrl: url, url: url.toString() });
  assert.equal(confirmed.status, 302);
  assert.match(confirmed.headers.get('location'), /email-change=updated/);
  assert.equal(account.email, 'new@example.com');
  assert.equal(account.emailVerifiedProvider, 'member-email-change');
  assert.equal(calls.filter(call => call[0] === 'gym').length, 1);

  const reused = await route.GET({ nextUrl: url, url: url.toString() });
  assert.match(reused.headers.get('location'), /email-change=invalid/);
  assert.equal(calls.filter(call => call[0] === 'gym').length, 1);
});
