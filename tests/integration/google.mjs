import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { generateKeyPairSync, randomUUID, sign, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export async function startGoogle() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const codes = new Map();
  const server = http.createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/.well-known/openid-configuration') {
      response.end(JSON.stringify({
        issuer: 'https://accounts.google.com',
        authorization_endpoint: 'https://accounts.google.com/authorize',
        token_endpoint: 'https://oauth2.googleapis.com/token',
        jwks_uri: 'https://www.googleapis.com/jwks',
        response_types_supported: ['code'], subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
        code_challenge_methods_supported: ['S256'],
      }));
    } else if (request.url === '/jwks') {
      response.end(JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'fixture', use: 'sig', alg: 'RS256' }] }));
    } else if (request.url === '/token') {
      let body = '';
      for await (const chunk of request) body += chunk;
      const params = new URLSearchParams(body);
      const code = codes.get(params.get('code'));
      codes.delete(params.get('code'));
      const challenge = createHash('sha256').update(params.get('code_verifier') ?? '').digest('base64url');
      if (!code || challenge !== code.challenge || params.get('redirect_uri') !== code.redirectUri) {
        response.writeHead(400).end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        iss: 'https://accounts.google.com', aud: 'isolated-test-client', iat: now, exp: now + 300,
        ...code.profile,
      })).toString('base64url');
      const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
      response.end(JSON.stringify({ access_token: 'test-access-secret', token_type: 'Bearer', expires_in: 300, id_token: `${header}.${payload}.${signature}` }));
    } else response.writeHead(404).end('{}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    env: {
      TEST_GOOGLE_ORIGIN: `http://127.0.0.1:${server.address().port}`,
      NODE_OPTIONS: `--require="${fileURLToPath(new URL('./google-transport.cjs', import.meta.url)).replaceAll('\\', '/')}"`,
    },
    async stop() { await new Promise((resolve) => server.close(resolve)); },
    async signIn(application, profile, existingCookie = '') {
      const cookies = new Map(existingCookie.split('; ').filter(Boolean).map((cookie) => cookie.split('=')));
      function collect(response) {
        for (const cookie of response.headers.getSetCookie()) {
          const [name, ...value] = cookie.split(';')[0].split('=');
          cookies.set(name, value.join('='));
        }
      }
      const csrfResponse = await fetch(`${application.url}/api/auth/csrf`);
      collect(csrfResponse);
      const { csrfToken } = await csrfResponse.json();
      const cookie = () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
      const initiated = await fetch(`${application.url}/api/auth/signin/google`, {
        method: 'POST', headers: { cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrfToken, callbackUrl: application.url, json: 'true' }),
      });
      collect(initiated);
      const authorization = new URL((await initiated.json()).url);
      assert.equal(authorization.hostname, 'accounts.google.com', application.logs());
      const code = randomUUID();
      codes.set(code, {
        profile, challenge: authorization.searchParams.get('code_challenge'),
        redirectUri: authorization.searchParams.get('redirect_uri'),
      });
      const callback = new URL('/api/auth/callback/google', application.url);
      callback.searchParams.set('code', code);
      callback.searchParams.set('state', authorization.searchParams.get('state'));
      const result = await fetch(callback, { redirect: 'manual', headers: { cookie: cookie() } });
      collect(result);
      return { response: result, cookie: cookie(), location: result.headers.get('location') };
    },
  };
}
