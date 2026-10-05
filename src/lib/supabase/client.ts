import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client untuk digunakan dalam Client Components (browser).
 * Menggunakan anon key — akses data dikawal oleh RLS.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
