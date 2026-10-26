'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import type { UserRole } from '@/lib/types';

export interface TeacherInput {
  full_name: string;
  email: string;
  phone_number: string;
  role: Extract<UserRole, 'teacher' | 'admin_papn'>;
  is_active: boolean;
  /** Kata laluan baharu — wajib semasa tambah, kosong bermakna kekal. */
  password: string;
  class_ids: string[];
}

export interface TeacherActionResult {
  ok: boolean;
  error?: string;
}

/** Domain e-mel dalaman untuk akaun berasaskan nombor telefon. */
const PHONE_EMAIL_DOMAIN = 'papn.local';

/** Sahkan pengguna ialah pentadbir (admin_papn / super_admin). */
async function requireAdmin() {
  const profile = await getCurrentUser();
  if (!profile) {
    return { profile: null, error: 'Sesi tamat. Sila log masuk semula.' };
  }
  if (profile.role !== 'admin_papn' && profile.role !== 'super_admin') {
    return { profile: null, error: 'Anda tiada kebenaran untuk tindakan ini.' };
  }
  return { profile, error: null };
}

/** Buang rentetan kosong menjadi null. */
function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length ? trimmed : null;
}

/** Menormalkan nombor telefon kepada digit sahaja. */
function normalisePhone(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Menentukan e-mel log masuk. Jika e-mel kosong, nombor telefon ditukar
 * kepada format dalaman `{digit}@papn.local` (selaras dengan log masuk).
 */
function resolveLoginEmail(email: string, phone: string): string | null {
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedEmail) return trimmedEmail;

  const digits = normalisePhone(phone);
  if (!digits) return null;
  return `${digits}@${PHONE_EMAIL_DOMAIN}`;
}

/** Tapis id kelas kepada yang benar-benar milik tenant pengguna. */
async function validClassIds(
  tenantId: string,
  classIds: string[]
): Promise<string[]> {
  const unique = Array.from(new Set(classIds.filter(Boolean)));
  if (unique.length === 0) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from('classes')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', unique);

  return (data ?? []).map((row: { id: string }) => row.id);
}

/** Gantikan tugasan kelas bagi seorang pendidik. */
async function syncTeacherClasses(
  teacherId: string,
  tenantId: string,
  classIds: string[]
): Promise<string | null> {
  const admin = createAdminClient();
  const valid = await validClassIds(tenantId, classIds);

  const { error: deleteError } = await admin
    .from('class_teachers')
    .delete()
    .eq('teacher_id', teacherId)
    .eq('tenant_id', tenantId);

  if (deleteError) {
    return `Gagal mengemas kini tugasan kelas: ${deleteError.message}`;
  }

  if (valid.length === 0) return null;

  const { error: insertError } = await admin.from('class_teachers').insert(
    valid.map((classId) => ({
      tenant_id: tenantId,
      class_id: classId,
      teacher_id: teacherId,
    }))
  );

  if (insertError) {
    return `Gagal menyimpan tugasan kelas: ${insertError.message}`;
  }

  return null;
}

/** Sahkan pendidik milik tenant pengguna. */
async function isTeacherInTenant(
  teacherId: string,
  tenantId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('id, role')
    .eq('id', teacherId)
    .eq('tenant_id', tenantId)
    .in('role', ['teacher', 'admin_papn'])
    .maybeSingle();

  return Boolean(data);
}

/** Tambah pendidik baharu (akaun auth + profil + tugasan kelas). */
export async function createTeacher(
  input: TeacherInput
): Promise<TeacherActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  const fullName = input.full_name.trim();
  if (!fullName) {
    return { ok: false, error: 'Nama penuh pendidik diperlukan.' };
  }

  const loginEmail = resolveLoginEmail(input.email, input.phone_number);
  if (!loginEmail) {
    return {
      ok: false,
      error: 'Sila masukkan e-mel atau nombor telefon untuk log masuk.',
    };
  }

  const password = input.password.trim();
  if (password.length < 6) {
    return { ok: false, error: 'Kata laluan mesti sekurang-kurangnya 6 aksara.' };
  }

  const admin = createAdminClient();

  // Langkah 1: cipta akaun Supabase Auth supaya pendidik boleh log masuk.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !created.user) {
    return {
      ok: false,
      error: `Gagal mencipta akaun log masuk: ${authError?.message ?? 'Ralat tidak diketahui.'}`,
    };
  }

  // Langkah 2: simpan profil dalam public.users.
  const { error: insertError } = await admin.from('users').insert({
    id: created.user.id,
    tenant_id: profile.tenant_id,
    full_name: fullName,
    email: loginEmail,
    phone_number: emptyToNull(input.phone_number),
    role: input.role,
    is_active: input.is_active,
  });

  if (insertError) {
    // Gulung balik akaun auth supaya tidak tertinggal akaun yatim.
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      ok: false,
      error: `Gagal menyimpan profil pendidik: ${insertError.message}`,
    };
  }

  // Langkah 3: tugasan kelas.
  const classError = await syncTeacherClasses(
    created.user.id,
    profile.tenant_id,
    input.class_ids
  );

  if (classError) return { ok: false, error: classError };

  revalidatePath('/admin/pendidik');
  return { ok: true };
}

/** Kemas kini pendidik sedia ada (disahkan milik tenant pengguna). */
export async function updateTeacher(
  teacherId: string,
  input: TeacherInput
): Promise<TeacherActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  if (!(await isTeacherInTenant(teacherId, profile.tenant_id))) {
    return { ok: false, error: 'Pendidik tidak dijumpai dalam pusat anda.' };
  }

  const fullName = input.full_name.trim();
  if (!fullName) {
    return { ok: false, error: 'Nama penuh pendidik diperlukan.' };
  }

  const loginEmail = resolveLoginEmail(input.email, input.phone_number);
  if (!loginEmail) {
    return {
      ok: false,
      error: 'Sila masukkan e-mel atau nombor telefon untuk log masuk.',
    };
  }

  const password = input.password.trim();
  if (password && password.length < 6) {
    return { ok: false, error: 'Kata laluan mesti sekurang-kurangnya 6 aksara.' };
  }

  const admin = createAdminClient();

  // Selaraskan akaun auth apabila e-mel / kata laluan berubah.
  const authUpdate: { email: string; password?: string } = { email: loginEmail };
  if (password) authUpdate.password = password;

  const { error: authError } = await admin.auth.admin.updateUserById(
    teacherId,
    authUpdate
  );

  if (authError) {
    return {
      ok: false,
      error: `Gagal mengemas kini akaun log masuk: ${authError.message}`,
    };
  }

  const { error: updateError } = await admin
    .from('users')
    .update({
      full_name: fullName,
      email: loginEmail,
      phone_number: emptyToNull(input.phone_number),
      role: input.role,
      is_active: input.is_active,
    })
    .eq('id', teacherId)
    .eq('tenant_id', profile.tenant_id);

  if (updateError) {
    return {
      ok: false,
      error: `Gagal mengemas kini pendidik: ${updateError.message}`,
    };
  }

  const classError = await syncTeacherClasses(
    teacherId,
    profile.tenant_id,
    input.class_ids
  );

  if (classError) return { ok: false, error: classError };

  revalidatePath('/admin/pendidik');
  return { ok: true };
}

/** Padam pendidik (profil + akaun auth + tugasan kelas). */
export async function deleteTeacher(
  teacherId: string
): Promise<TeacherActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  if (teacherId === profile.id) {
    return { ok: false, error: 'Anda tidak boleh memadam akaun anda sendiri.' };
  }

  if (!(await isTeacherInTenant(teacherId, profile.tenant_id))) {
    return { ok: false, error: 'Pendidik tidak dijumpai dalam pusat anda.' };
  }

  const admin = createAdminClient();

  const { error: deleteError } = await admin
    .from('users')
    .delete()
    .eq('id', teacherId)
    .eq('tenant_id', profile.tenant_id);

  if (deleteError) {
    return { ok: false, error: `Gagal memadam pendidik: ${deleteError.message}` };
  }

  // Padam akaun auth selepas profil berjaya dipadam.
  await admin.auth.admin.deleteUser(teacherId);

  revalidatePath('/admin/pendidik');
  return { ok: true };
}
