import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client dengan service role key — MEMINTAS RLS.
 *
 * AMARAN: Hanya gunakan dalam kod pelayan (server-only) untuk operasi
 * pentadbiran seperti pengesahan peranan semasa log masuk. Jangan sekali-kali
 * dedahkan kunci ini kepada pelanggan atau import ke dalam Client Component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY diperlukan untuk klien pentadbir.'
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
