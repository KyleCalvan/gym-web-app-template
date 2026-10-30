import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import type { NextRequest } from 'next/server';

export function supabaseOAuthClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase Auth is not configured');
  const jar = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]));
  const writes: Parameters<NonNullable<CookieMethodsServer['setAll']>>[0] = [];
  const client = createServerClient(url, key, {
    auth: { flowType: 'pkce', autoRefreshToken: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll(items) {
        for (const item of items) {
          jar.set(item.name, item.value);
          writes.push(item);
        }
      },
    },
  });
  return { client, writes };
}
