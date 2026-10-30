import { NextRequest, NextResponse } from 'next/server';
import { supabaseOAuthClient } from '@/src/auth/supabase-oauth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const base = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
    const callback = new URL('/api/supabase/google/callback', base);
    const { client, writes } = supabaseOAuthClient(request);
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'google',
      options: { redirectTo: callback.toString(), skipBrowserRedirect: true } });
    if (error || !data.url) throw error ?? new Error('Google authorization URL unavailable');
    const destination = new URL(data.url);
    if (destination.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin)
      throw new Error('Unexpected Google authorization origin');
    const response = NextResponse.redirect(destination);
    response.headers.set('cache-control', 'private, no-store');
    for (const { name, value, options } of writes) response.cookies.set(name, value, options);
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?error=OAuthSignin', process.env.NEXTAUTH_URL ?? request.url));
  }
}
