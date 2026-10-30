type SupabaseUser = { id: string; email?: string; email_confirmed_at?: string | null;
  app_metadata?: { app_account_id?: string } };
type PasswordResult = { user: SupabaseUser; access_token: string };

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !publishableKey || !secretKey) return null;
  return { url: url.replace(/\/$/, ''), publishableKey, secretKey };
}

export function supabaseAuthConfigured() {
  return config() !== null;
}

export function legacyAuthTestMode() {
  return process.env.INTEGRATION_SESSION_KEY === 'isolated-session-test-driver';
}

async function authRequest(path: string, method: string, body?: object, admin = false) {
  const settings = config();
  if (!settings) throw new Error('Supabase Auth is not configured');
  const key = admin ? settings.secretKey : settings.publishableKey;
  const response = await fetch(`${settings.url}/auth/v1${path}`, {
    method,
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store', signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, result };
}

export async function supabasePasswordSignIn(email: string, password: string): Promise<PasswordResult | null> {
  const response = await authRequest('/token?grant_type=password', 'POST', { email, password });
  if (response.ok && typeof response.result.user?.id === 'string' && typeof response.result.access_token === 'string') {
    return response.result as PasswordResult;
  }
  if (response.status === 400 || response.status === 401 || response.status === 422) return null;
  throw new Error(`Supabase Auth sign-in failed (${response.status})`);
}

export async function findSupabaseUser(email: string): Promise<SupabaseUser | null> {
  // The admin endpoint has no exact-email lookup. Limit this to server-side
  // account establishment; never expose the returned list to a browser.
  for (let page = 1; page <= 20; page++) {
    const response = await authRequest(`/admin/users?page=${page}&per_page=1000`, 'GET', undefined, true);
    if (!response.ok || !Array.isArray(response.result.users)) throw new Error('Supabase Auth user lookup failed');
    const found = (response.result.users as SupabaseUser[]).find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (response.result.users.length < 1000) return null;
  }
  throw new Error('Supabase Auth user lookup exceeded its page limit');
}

export async function createSupabaseUser(email: string, password: string, confirmed: boolean, accountId?: string) {
  const response = await authRequest('/admin/users', 'POST', {
    email, password, email_confirm: confirmed,
    ...(accountId ? { app_metadata: { app_account_id: accountId } } : {}),
  }, true);
  if (!response.ok || typeof response.result.id !== 'string') {
    throw new Error(`Supabase Auth user creation failed (${response.status})`);
  }
  return response.result as SupabaseUser;
}

export async function updateSupabaseUser(id: string, values: { password?: string; email_confirm?: boolean }) {
  const response = await authRequest(`/admin/users/${encodeURIComponent(id)}`, 'PUT', values, true);
  if (!response.ok) throw new Error(`Supabase Auth user update failed (${response.status})`);
}

export async function deleteSupabaseUser(id: string) {
  const response = await authRequest(`/admin/users/${encodeURIComponent(id)}`, 'DELETE', undefined, true);
  if (!response.ok) throw new Error(`Supabase Auth user rollback failed (${response.status})`);
}

