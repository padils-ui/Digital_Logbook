'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ROLE_COOKIE, STATUS_COOKIE } from '@/middleware';
import type { UserRole } from '@/lib/types';

export interface SignupState {
  /** Mesej ralat untuk dipaparkan pada borang. */
  error?: string;
  /** Ditetapkan apabila pendaftaran berjaya — klien akan navigasi ke laluan ini. */
  redirectTo?: string;
}

/** Peranan yang dibenarkan mendaftar sendiri (pentadbir dicipta oleh super admin). */
const SIGNUP_ROLES: UserRole[] = ['parent', 'teacher'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Corak ralat pengesahan e-mel yang dipulangkan oleh Supabase Auth.
 * Supabase boleh menolak e-mel walaupun ia lulus `EMAIL_PATTERN` (contohnya
 * domain tidak sah atau aksara tersembunyi), jadi ralat ini dipetakan kepada
 * mesej Bahasa Melayu yang mudah difahami.
 */
const EMAIL_ERROR_PATTERN =
  /invalid email|email.{0,40}(invalid|not valid|malformed)|unable to validate email|email_address_invalid|validation_failed/i;

const EMAIL_HELP_MESSAGE =
  'Sila pastikan format e-mel adalah betul dan tiada ruang kosong.';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** Bandingkan kod akses tanpa mengira huruf besar/kecil dan ruang tepi. */
function normaliseCode(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Pendaftaran sendiri berpagar kod akses pusat.
 *
 * NOTA KESELAMATAN: borang ini dijalankan SEBELUM pengguna mempunyai sesi,
 * jadi `tenant_id` terpaksa diterima daripada borang. Ini satu-satunya
 * pengecualian kepada peraturan `.traerules` "tiada tenant_id dalam input
 * tindakan". Nilai tersebut disahkan semula di pelayan terhadap jadual
 * `tenants` DAN kod akses `center_settings.code` sebelum akaun dicipta.
 */
export async function registerAction(formData: FormData): Promise<SignupState> {
  const fullName = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');
  const role = String(formData.get('role') ?? '') as UserRole;
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const accessCode = String(formData.get('access_code') ?? '').trim();

  if (fullName.length < 2) {
    return { error: 'Sila masukkan nama penuh anda.' };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Sila masukkan alamat e-mel yang sah.' };
  }
  if (password.length < 8) {
    return { error: 'Kata laluan mesti sekurang-kurangnya 8 aksara.' };
  }
  if (password !== confirmPassword) {
    return { error: 'Kata laluan dan pengesahan kata laluan tidak sepadan.' };
  }
  if (!SIGNUP_ROLES.includes(role)) {
    return { error: 'Sila pilih peranan anda.' };
  }
  if (!tenantId) {
    return { error: 'Sila pilih pusat PAPN anda.' };
  }
  if (!accessCode) {
    return { error: 'Sila masukkan Kod Akses Pusat.' };
  }

  const admin = createAdminClient();

  // Langkah 1: sahkan pusat PAPN yang dipilih benar-benar wujud.
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError) {
    return { error: 'Ralat semasa mengesahkan pusat PAPN. Sila cuba lagi.' };
  }
  if (!tenant) {
    return { error: 'Pusat PAPN yang dipilih tidak ditemui.' };
  }

  // Langkah 2: padankan Kod Akses Pusat. Kod hanya dibandingkan di pelayan
  // dan tidak pernah dihantar ke pelayar.
  const { data: settings, error: settingsError } = await admin
    .from('center_settings')
    .select('code')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (settingsError) {
    return { error: 'Ralat semasa mengesahkan Kod Akses Pusat. Sila cuba lagi.' };
  }

  const expectedCode = settings?.code ? normaliseCode(settings.code) : null;
  if (!expectedCode) {
    return {
      error: `Pusat ${tenant.name} belum menetapkan Kod Akses Pusat. Sila hubungi pentadbir PAPN.`,
    };
  }
  if (normaliseCode(accessCode) !== expectedCode) {
    return {
      error: 'Kod Akses Pusat tidak sah untuk pusat yang dipilih. Sila semak dengan pentadbir PAPN.',
    };
  }

  // Langkah 3: elak e-mel berganda dalam `public.users`.
  const { data: existing, error: existingError } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingError) {
    return { error: 'Ralat semasa menyemak e-mel. Sila cuba lagi.' };
  }
  if (existing) {
    return {
      error: 'E-mel ini telah didaftarkan. Sila log masuk atau hubungi pentadbir PAPN.',
    };
  }

  // Langkah 4: cipta akaun Supabase Auth selepas kod disahkan.
  const supabase = createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  });

  if (signUpError) {
    if (/already registered|already been registered/i.test(signUpError.message)) {
      return {
        error: 'E-mel ini telah didaftarkan. Sila log masuk atau hubungi pentadbir PAPN.',
      };
    }
    if (
      signUpError.code === 'email_address_invalid' ||
      EMAIL_ERROR_PATTERN.test(signUpError.message)
    ) {
      return { error: EMAIL_HELP_MESSAGE };
    }
    return {
      error: `Pendaftaran gagal: ${signUpError.message}`,
    };
  }

  // Supabase memulangkan objek pengguna "samaran" (identities kosong) apabila
  // e-mel sudah wujud, bagi mengelakkan pendedahan maklumat.
  const user = signUpData.user;
  if (!user || user.identities?.length === 0) {
    return {
      error: 'E-mel ini telah didaftarkan. Sila log masuk atau hubungi pentadbir PAPN.',
    };
  }

  // Langkah 5: pastikan sesi wujud supaya pengguna boleh melihat skrin
  // menunggu kelulusan. Projek ini mewajibkan pengesahan e-mel, jadi akaun
  // yang baru didaftarkan belum mempunyai sesi. Akaun tetap berpagar oleh
  // kod akses pusat dan kelulusan pentadbir, dan semua akaun yang dicipta
  // oleh pentadbir PAPN juga menggunakan `email_confirm: true`.
  if (!signUpData.session) {
    const { error: firstSignInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (firstSignInError) {
      const { error: confirmError } = await admin.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
      );

      const { error: secondSignInError } = confirmError
        ? { error: confirmError }
        : await supabase.auth.signInWithPassword({ email, password });

      if (secondSignInError) {
        await admin.auth.admin.deleteUser(user.id);
        return {
          error:
            'Akaun dicipta tetapi sesi tidak dapat dimulakan. Sila log masuk semula.',
        };
      }
    }
  }

  // Langkah 6: rekod profil dengan status menunggu kelulusan.
  const { error: insertError } = await admin.from('users').insert({
    id: user.id,
    tenant_id: tenantId,
    full_name: fullName,
    email,
    role,
    status: 'pending',
    is_active: true,
  });

  if (insertError) {
    await supabase.auth.signOut();
    await admin.auth.admin.deleteUser(user.id);
    return {
      error: `Gagal menyimpan profil anda: ${insertError.message}`,
    };
  }

  // Langkah 7: tetapkan cookie supaya middleware (Edge) dapat mengawal akses
  // tanpa mengakses pangkalan data.
  const cookieStore = cookies();
  const cookieOptions = {
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
  cookieStore.set(ROLE_COOKIE, role, cookieOptions);
  cookieStore.set(STATUS_COOKIE, 'pending', cookieOptions);

  return { redirectTo: '/pending-approval' };
}
