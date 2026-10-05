import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Pertukaran kod OAuth / magic link kepada sesi.
 * Digunakan oleh aliran pengesahan Supabase.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
