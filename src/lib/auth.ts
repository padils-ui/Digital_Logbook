import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { ROLE_COOKIE } from '@/middleware';
import type { AppUser, UserRole } from '@/lib/types';

/** Memulangkan pengguna auth semasa atau null. */
export async function getSessionUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Memulangkan profil pengguna (jadual `users`) atau null.
 *
 * Strategi dwi-klien:
 * 1. Cuba baca sesi melalui klien SSR biasa (anon key).
 * 2. Jika gagal (sesi belum disegerakkan pada permintaan pertama selepas
 *    window.location.href), gunakan klien admin untuk dapatkan user.id
 *    daripada cookies sb-* secara langsung.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = createClient();
  const {
    data: { user: anonUser },
  } = await supabase.auth.getUser();

  let userId: string | null = anonUser?.id ?? null;

  // Fallback: jika anon client tidak dapat user, cuba ekstrak user.id
  // dari cookie sesi Supabase secara langsung menggunakan admin client.
  if (!userId) {
    const cookieStore = cookies();
    const roleCookie = cookieStore.get(ROLE_COOKIE)?.value;

    // Hanya cuba fallback jika cookie papn_role ada (bermakna login berjaya).
    if (roleCookie) {
      // Cari mana-mana cookie sb-*-auth-token untuk ekstrak user.id.
      const allCookies = cookieStore.getAll();
      const authTokenCookie = allCookies.find(
        (c) => c.name.includes('-auth-token') && !c.name.includes('code-verifier')
      );

      if (authTokenCookie) {
        try {
          // Cookie mungkin dalam bentuk base64 JSON atau JWT.
          // Supabase @supabase/ssr menyimpan sebagai base64-encoded JSON.
          let decoded = authTokenCookie.value;
          if (decoded.startsWith('base64-')) {
            decoded = Buffer.from(decoded.slice(7), 'base64').toString('utf-8');
          }
          const parsed = JSON.parse(decoded);
          userId = parsed?.user?.id ?? parsed?.[0]?.user?.id ?? null;
        } catch {
          // Bukan format JSON — mungkin JWT terus, skip.
        }
      }
    }
  }

  if (!userId) return null;

  // Gunakan admin client untuk dapatkan profil — tidak terjejas oleh
  // kelewatan pengesahan token Supabase.
  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  return (data as AppUser) ?? null;
}

/** Memulangkan peranan pengguna semasa, lalai 'parent'. */
export async function getCurrentRole(): Promise<UserRole> {
  const profile = await getCurrentUser();
  return profile?.role ?? 'parent';
}

/** Laluan pendaratan mengikut peranan. */
export function roleHome(role: UserRole): string {
  switch (role) {
    case 'super_admin':
    case 'admin_papn':
      return '/dashboard';
    case 'teacher':
      return '/teacher';
    case 'parent':
      return '/parent';
  }
}
