'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

export interface ClassInput {
  class_name: string;
  year: number;
}

export interface ClassActionResult {
  ok: boolean;
  error?: string;
}

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

/** Tambah kelas baharu untuk tenant pengguna. */
export async function createClass(
  input: ClassInput
): Promise<ClassActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  const className = (input.class_name ?? '').trim();
  if (!className) {
    return { ok: false, error: 'Nama kelas diperlukan.' };
  }
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 1 || year > 12) {
    return { ok: false, error: 'Tahun (umur) mesti antara 1 hingga 12.' };
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin.from('classes').insert({
    tenant_id: profile.tenant_id,
    class_name: className,
    year,
  });

  if (insertError) {
    return { ok: false, error: `Gagal menambah kelas: ${insertError.message}` };
  }

  revalidatePath('/admin/classes');
  revalidatePath('/admin/students');
  return { ok: true };
}

/** Kemas kini kelas sedia ada (disahkan milik tenant pengguna). */
export async function updateClass(
  classId: string,
  input: ClassInput
): Promise<ClassActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  const className = (input.class_name ?? '').trim();
  if (!className) {
    return { ok: false, error: 'Nama kelas diperlukan.' };
  }
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 1 || year > 12) {
    return { ok: false, error: 'Tahun (umur) mesti antara 1 hingga 12.' };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from('classes')
    .update({ class_name: className, year })
    .eq('id', classId)
    .eq('tenant_id', profile.tenant_id);

  if (updateError) {
    return { ok: false, error: `Gagal mengemas kini kelas: ${updateError.message}` };
  }

  revalidatePath('/admin/classes');
  revalidatePath('/admin/students');
  return { ok: true };
}

/**
 * Padam kelas. Menyekat pemadaman jika masih ada anak ditugaskan
 * kepada kelas ini (perlindungan integriti data).
 */
export async function deleteClass(classId: string): Promise<ClassActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  const admin = createAdminClient();

  // Semak bilangan anak yang masih ditugaskan ke kelas ini.
  const { count, error: countError } = await admin
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('tenant_id', profile.tenant_id);

  if (countError) {
    return { ok: false, error: `Gagal menyemak anak: ${countError.message}` };
  }

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Kelas ini masih mempunyai ${count} anak. Sila pindahkan anak terlebih dahulu sebelum memadam.`,
    };
  }

  const { error: deleteError } = await admin
    .from('classes')
    .delete()
    .eq('id', classId)
    .eq('tenant_id', profile.tenant_id);

  if (deleteError) {
    return { ok: false, error: `Gagal memadam kelas: ${deleteError.message}` };
  }

  revalidatePath('/admin/classes');
  revalidatePath('/admin/students');
  return { ok: true };
}
