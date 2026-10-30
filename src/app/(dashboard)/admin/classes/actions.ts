'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

export interface ClassInput {
  class_name: string;
  year: number;
  /** Senarai id pendidik yang ditugaskan ke kelas ini. */
  teacher_ids: string[];
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

/** Normalisasi senarai id pendidik (buang kosong & ulangan). */
function normaliseIds(ids: string[] | undefined): string[] {
  return Array.from(new Set((ids ?? []).filter(Boolean)));
}

/**
 * Tapis id pendidik kepada yang benar-benar milik tenant pengguna
 * dan berperanan sebagai pendidik / pentadbir.
 */
async function validTeacherIds(
  tenantId: string,
  teacherIds: string[]
): Promise<string[]> {
  const unique = normaliseIds(teacherIds);
  if (unique.length === 0) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('role', ['teacher', 'admin_papn'])
    .in('id', unique);

  return (data ?? []).map((row: { id: string }) => row.id);
}

/** Gantikan tugasan pendidik bagi sebuah kelas. */
async function syncClassTeachers(
  classId: string,
  tenantId: string,
  teacherIds: string[]
): Promise<string | null> {
  const admin = createAdminClient();
  const valid = await validTeacherIds(tenantId, teacherIds);

  const { error: deleteError } = await admin
    .from('class_teachers')
    .delete()
    .eq('class_id', classId)
    .eq('tenant_id', tenantId);

  if (deleteError) {
    return `Gagal mengemas kini tugasan pendidik: ${deleteError.message}`;
  }

  if (valid.length === 0) return null;

  const { error: insertError } = await admin.from('class_teachers').insert(
    valid.map((teacherId) => ({
      tenant_id: tenantId,
      class_id: classId,
      teacher_id: teacherId,
    }))
  );

  if (insertError) {
    return `Gagal menyimpan tugasan pendidik: ${insertError.message}`;
  }

  return null;
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
  const { data: created, error: insertError } = await admin
    .from('classes')
    .insert({
      tenant_id: profile.tenant_id,
      class_name: className,
      year,
    })
    .select('id')
    .single();

  if (insertError || !created) {
    return {
      ok: false,
      error: `Gagal menambah kelas: ${insertError?.message ?? 'rekod tidak dikembalikan'}`,
    };
  }

  const syncError = await syncClassTeachers(
    (created as { id: string }).id,
    profile.tenant_id,
    input.teacher_ids
  );
  if (syncError) return { ok: false, error: syncError };

  revalidatePath('/admin/classes');
  revalidatePath('/admin/students');
  revalidatePath('/admin/pendidik');
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
  const { data: updated, error: updateError } = await admin
    .from('classes')
    .update({ class_name: className, year })
    .eq('id', classId)
    .eq('tenant_id', profile.tenant_id)
    .select('id')
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: `Gagal mengemas kini kelas: ${updateError.message}` };
  }
  if (!updated) {
    return { ok: false, error: 'Kelas tidak dijumpai untuk pusat anda.' };
  }

  const syncError = await syncClassTeachers(
    classId,
    profile.tenant_id,
    input.teacher_ids
  );
  if (syncError) return { ok: false, error: syncError };

  revalidatePath('/admin/classes');
  revalidatePath('/admin/students');
  revalidatePath('/admin/pendidik');
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
  revalidatePath('/admin/pendidik');
  return { ok: true };
}
