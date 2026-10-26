'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

export interface ParentInput {
  full_name: string;
  email: string;
  phone_number: string;
  is_active: boolean;
  /** Kata laluan baharu — wajib semasa tambah, kosong bermakna kekal. */
  password: string;
}

export interface ParentActionResult {
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

/** Menentukan e-mel log masuk daripada e-mel atau nombor telefon. */
function resolveLoginEmail(email: string, phone: string): string | null {
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedEmail) return trimmedEmail;

  const digits = normalisePhone(phone);
  if (!digits) return null;
  return `${digits}@${PHONE_EMAIL_DOMAIN}`;
}

/** Sahkan ibu bapa / penjaga milik tenant pengguna. */
async function isParentInTenant(
  parentId: string,
  tenantId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('id')
    .eq('id', parentId)
    .eq('tenant_id', tenantId)
    .eq('role', 'parent')
    .maybeSingle();

  return Boolean(data);
}

/** Sahkan anak milik tenant pengguna. */
async function isStudentInTenant(
  studentId: string,
  tenantId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return Boolean(data);
}

/** Tambah akaun ibu bapa / penjaga. */
export async function createParent(
  input: ParentInput
): Promise<ParentActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  const fullName = input.full_name.trim();
  if (!fullName) {
    return { ok: false, error: 'Nama penuh ibu bapa diperlukan.' };
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

  // Langkah 1: cipta akaun Supabase Auth.
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
    role: 'parent',
    is_active: input.is_active,
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      ok: false,
      error: `Gagal menyimpan profil ibu bapa: ${insertError.message}`,
    };
  }

  revalidatePath('/admin/ibu-bapa');
  return { ok: true };
}

/** Kemas kini profil ibu bapa sedia ada. */
export async function updateParent(
  parentId: string,
  input: ParentInput
): Promise<ParentActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  if (!(await isParentInTenant(parentId, profile.tenant_id))) {
    return { ok: false, error: 'Ibu bapa tidak dijumpai dalam pusat anda.' };
  }

  const fullName = input.full_name.trim();
  if (!fullName) {
    return { ok: false, error: 'Nama penuh ibu bapa diperlukan.' };
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

  const authUpdate: { email: string; password?: string } = { email: loginEmail };
  if (password) authUpdate.password = password;

  const { error: authError } = await admin.auth.admin.updateUserById(
    parentId,
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
      is_active: input.is_active,
    })
    .eq('id', parentId)
    .eq('tenant_id', profile.tenant_id);

  if (updateError) {
    return {
      ok: false,
      error: `Gagal mengemas kini ibu bapa: ${updateError.message}`,
    };
  }

  revalidatePath('/admin/ibu-bapa');
  return { ok: true };
}

/** Padam ibu bapa (profil, akaun auth dan pautan anak). */
export async function deleteParent(
  parentId: string
): Promise<ParentActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  if (parentId === profile.id) {
    return { ok: false, error: 'Anda tidak boleh memadam akaun anda sendiri.' };
  }

  if (!(await isParentInTenant(parentId, profile.tenant_id))) {
    return { ok: false, error: 'Ibu bapa tidak dijumpai dalam pusat anda.' };
  }

  const admin = createAdminClient();

  const { error: deleteError } = await admin
    .from('users')
    .delete()
    .eq('id', parentId)
    .eq('tenant_id', profile.tenant_id);

  if (deleteError) {
    return { ok: false, error: `Gagal memadam ibu bapa: ${deleteError.message}` };
  }

  await admin.auth.admin.deleteUser(parentId);

  revalidatePath('/admin/ibu-bapa');
  return { ok: true };
}

/**
 * Pautkan anak kepada ibu bapa.
 * Jika `isPrimary` benar, pautan utama sedia ada bagi anak itu dilepaskan
 * terlebih dahulu (indeks unik separa membenarkan satu penjaga utama sahaja).
 */
export async function linkChild(
  parentId: string,
  studentId: string,
  relationshipType: string,
  isPrimary: boolean
): Promise<ParentActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  if (!(await isParentInTenant(parentId, profile.tenant_id))) {
    return { ok: false, error: 'Ibu bapa tidak dijumpai dalam pusat anda.' };
  }

  if (!(await isStudentInTenant(studentId, profile.tenant_id))) {
    return { ok: false, error: 'Anak tidak dijumpai dalam pusat anda.' };
  }

  const admin = createAdminClient();

  // Elak pautan berganda.
  const { data: existing } = await admin
    .from('parent_student_map')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: 'Anak ini sudah dipautkan kepada ibu bapa tersebut.' };
  }

  if (isPrimary) {
    const { error: clearError } = await admin
      .from('parent_student_map')
      .update({ is_primary: false })
      .eq('tenant_id', profile.tenant_id)
      .eq('student_id', studentId)
      .eq('is_primary', true);

    if (clearError) {
      return {
        ok: false,
        error: `Gagal mengemas kini penjaga utama: ${clearError.message}`,
      };
    }
  }

  const { error: insertError } = await admin.from('parent_student_map').insert({
    tenant_id: profile.tenant_id,
    parent_id: parentId,
    student_id: studentId,
    relationship_type: emptyToNull(relationshipType),
    is_primary: isPrimary,
  });

  if (insertError) {
    return { ok: false, error: `Gagal memautkan anak: ${insertError.message}` };
  }

  revalidatePath('/admin/ibu-bapa');
  return { ok: true };
}

/** Lepaskan pautan anak daripada ibu bapa. */
export async function unlinkChild(
  mapId: string
): Promise<ParentActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from('parent_student_map')
    .delete()
    .eq('id', mapId)
    .eq('tenant_id', profile.tenant_id);

  if (deleteError) {
    return { ok: false, error: `Gagal melepaskan pautan: ${deleteError.message}` };
  }

  revalidatePath('/admin/ibu-bapa');
  return { ok: true };
}

/** Tetapkan pautan sebagai penjaga utama bagi anak berkenaan. */
export async function setPrimaryGuardian(
  mapId: string
): Promise<ParentActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  const admin = createAdminClient();

  // Ambil pautan untuk mengetahui anak yang terlibat (disahkan milik tenant).
  const { data: link } = await admin
    .from('parent_student_map')
    .select('id, student_id')
    .eq('id', mapId)
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle();

  if (!link) {
    return { ok: false, error: 'Pautan tidak dijumpai dalam pusat anda.' };
  }

  const { error: clearError } = await admin
    .from('parent_student_map')
    .update({ is_primary: false })
    .eq('tenant_id', profile.tenant_id)
    .eq('student_id', link.student_id)
    .eq('is_primary', true);

  if (clearError) {
    return {
      ok: false,
      error: `Gagal mengemas kini penjaga utama: ${clearError.message}`,
    };
  }

  const { error: updateError } = await admin
    .from('parent_student_map')
    .update({ is_primary: true })
    .eq('id', mapId)
    .eq('tenant_id', profile.tenant_id);

  if (updateError) {
    return {
      ok: false,
      error: `Gagal menetapkan penjaga utama: ${updateError.message}`,
    };
  }

  revalidatePath('/admin/ibu-bapa');
  return { ok: true };
}
