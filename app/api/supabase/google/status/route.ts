import { NextResponse } from 'next/server';
import { supabaseAuthConfigured } from '@/src/auth/supabase-auth';

export const runtime = 'nodejs';

export async function GET() {
  if (!supabaseAuthConfigured()) return NextResponse.json({ google: false });
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      cache: 'no-store', signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error('Supabase Auth settings unavailable');
    const settings = await response.json();
    return NextResponse.json({ google: settings.external?.google === true },
      { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ google: false }, { headers: { 'cache-control': 'no-store' } });
  }
}
