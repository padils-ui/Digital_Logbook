'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ROLE_COOKIE, STATUS_COOKIE } from '@/middleware';
import { resolvePostLoginPath } from '@/lib/auth';
import type { UserApprovalStatus, UserRole } from '@/lib/types';

export interface LoginState {
  error?: string;
  /** Ditetapkan apabila log masuk berjaya — klien akan navigasi ke laluan ini. */
  redirectTo?: string;
}

/** Peranan yang sah dalam sistem. */
const VALID_ROLES: UserRole[] = [
  'super_admin',
  'admin_papn',
  'teacher',
  'parent',
];

/** Domain e-mel dalaman untuk akaun berasaskan nombor telefon. */
const PHONE_EMAIL_DOMAIN = 'papn.local';

/**
 * Membaca peranan dan status aktif pengguna daripada `public.users` menggunakan
 * klien service role (memintas RLS). Memulangkan `null` jika tiada profil.
 */
async function fetchAccount(userId: string): Promise<{
  role: UserRole;
  isActive: boolean;
  status: UserApprovalStatus;
} | null> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('users')
    .select('role, is_active, status')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  const role = profile?.role as UserRole | undefined;
  if (!role || !VALID_ROLES.includes(role)) return null;

  return {
    role,
    isActive: profile?.is_active !== false,
    status: (profile?.status as UserApprovalStatus) ?? 'approved',
  };
}


/** Menormalkan nombor telefon kepada digit sahaja. */
function normalisePhone(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Membina senarai calon e-mel untuk percubaan log masuk.
 * Menyokong e-mel sebenar DAN format `{phone}@papn.local`.
 */
function buildEmailCandidates(identifier: string): string[] {
  const trimmed = identifier.trim().toLowerCase();

  if (trimmed.includes('@')) {
    return [trimmed];
  }

  const digits = normalisePhone(trimmed);
  if (!digits) return [];

  const candidates = new Set<string>([`${digits}@${PHONE_EMAIL_DOMAIN}`]);

  // Sokong juga format tempatan Malaysia (contoh: 0123456789 -> 60123456789).
  if (digits.startsWith('0')) {
    candidates.add(`6${digits}@${PHONE_EMAIL_DOMAIN}`);
  }

  return Array.from(candidates);
}

/**
 * Log masuk menggunakan e-mel atau nombor telefon.
 * Jika input bukan e-mel, ia ditukar kepada format e-mel dalaman
 * (contoh: 0123456789@papn.local) supaya Supabase Auth dapat mengendalikannya.
 */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const identifier = String(formData.get('identifier') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const role = String(formData.get('role') ?? '') as UserRole;
  const redirectTo = String(formData.get('redirectTo') ?? '');

  if (!identifier || !password) {
    return { error: 'Sila masukkan e-mel/nombor telefon dan kata laluan.' };
  }

  if (!VALID_ROLES.includes(role)) {
    return { error: 'Sila pilih peranan anda.' };
  }

  const emailCandidates = buildEmailCandidates(identifier);
  if (emailCandidates.length === 0) {
    return { error: 'Sila masukkan e-mel atau nombor telefon yang sah.' };
  }

  const supabase = createClient();

  // Cuba setiap calon e-mel (e-mel sebenar atau {phone}@papn.local).
  let signedInUserId: string | null = null;
  for (const email of emailCandidates) {
    console.log('[loginAction] cuba e-mel:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('[loginAction] auth error:', error.status, error.message);
    }

    if (!error && data.user) {
      signedInUserId = data.user.id;
      console.log('[loginAction] auth berjaya, user.id:', signedInUserId);
      break;
    }
  }

  if (!signedInUserId) {
    return { error: 'Log masuk gagal. Sila semak e-mel/telefon dan kata laluan.' };
  }

  // Sahkan peranan menggunakan klien pentadbir (service role) supaya
  // pengesahan tidak terjejas oleh kependaman cookie/RLS selepas log masuk.
  let account: {
    role: UserRole;
    isActive: boolean;
    status: UserApprovalStatus;
  } | null = null;
  try {
    account = await fetchAccount(signedInUserId);
    console.log('[loginAction] peranan dalam pangkalan data:', account?.role);
  } catch (err) {
    console.error('[loginAction] fetchAccount gagal:', err);
    await supabase.auth.signOut();
    return {
      error:
        'Ralat semasa mengesahkan akaun. Sila cuba lagi atau hubungi pentadbir PAPN.',
    };
  }

  if (!account) {
    console.log('[loginAction] tiada profil untuk user.id:', signedInUserId);
    await supabase.auth.signOut();
    return {
      error:
        'Akaun anda belum didaftarkan dalam sistem. Sila hubungi pentadbir PAPN.',
    };
  }

  if (!account.isActive) {
    console.log('[loginAction] akaun dinyahaktifkan:', signedInUserId);
    await supabase.auth.signOut();
    return {
      error:
        'Akaun anda telah dinyahaktifkan. Sila hubungi pentadbir PAPN.',
    };
  }

  const actualRole = account.role;

  if (actualRole !== role) {
    console.log('[loginAction] peranan tidak sepadan — pilih:', role, 'sebenar:', actualRole);
    await supabase.auth.signOut();
    return { error: 'Peranan yang dipilih tidak sepadan dengan akaun anda.' };
  }

  if (account.status === 'rejected') {
    console.log('[loginAction] akaun ditolak:', signedInUserId);
    await supabase.auth.signOut();
    return {
      error:
        'Permohonan pendaftaran akaun anda telah ditolak. Sila hubungi pentadbir PAPN.',
    };
  }

  // Tetapkan cookie peranan supaya middleware (Edge runtime) boleh
  // menguatkuasakan kawalan akses tanpa mengakses service role key.
  const cookieStore = cookies();
  cookieStore.set(ROLE_COOKIE, actualRole, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  cookieStore.set(STATUS_COOKIE, account.status, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  console.log('[loginAction] cookie papn_role ditetapkan:', actualRole, 'status:', account.status);

  // Akaun 'pending' masih boleh log masuk supaya mereka boleh melihat skrin
  // /pending-approval dan log keluar — tetapi tidak boleh masuk ruang kerja.
  if (account.status === 'pending') {
    return { redirectTo: '/pending-approval' };
  }

  const destination = resolvePostLoginPath(actualRole, redirectTo);
  return { redirectTo: destination };
}
