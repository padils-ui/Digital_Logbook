'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

export interface StudentInput {
  full_name: string;
  nickname: string | null;
  mykid_number: string | null;
  dob: string | null;
  class_id: string | null;
  gender: 'L' | 'P' | null;
  parent_name: string | null;
  parent_phone: string | null;
  special_notes: string | null;
  photo_url: string | null;
}

export interface StudentActionResult {
  ok: boolean;
  error?: string;
}

/** Kelas lalai yang dicipta automatik jika tenant belum ada kelas. */
const DEFAULT_CLASSES: { class_name: string; year: number }[] = [
  { class_name: 'Kelas 2 Tahun', year: 2 },
  { class_name: 'Kelas 3 Tahun', year: 3 },
  { class_name: 'Kelas 4 Tahun', year: 4 },
];

/** Buang rentetan kosong menjadi null. */
function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Pastikan tenant mempunyai sekurang-kurangnya kelas lalai.
 * Menggunakan klien admin (memintas RLS) supaya tidak tersekat oleh
 * rekursi dasar RLS pada jadual `users`.
 */
export async function ensureDefaultClasses(tenantId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('classes')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1);

  if (existing && existing.length > 0) return;

  await admin.from('classes').insert(
    DEFAULT_CLASSES.map((c) => ({
      tenant_id: tenantId,
      class_name: c.class_name,
      year: c.year,
    }))
  );
}

/**
 * Sahkan bahawa kelas yang dipilih milik tenant pengguna.
 * Memulangkan true jika class_id null atau sah.
 */
async function isClassValid(
  classId: string | null,
  tenantId: string
): Promise<boolean> {
  if (!classId) return true;
  const admin = createAdminClient();
  const { data } = await admin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return Boolean(data);
}

/** Tambah murid baharu untuk tenant pengguna. */
export async function createStudent(
  input: StudentInput
): Promise<StudentActionResult> {
  const profile = await getCurrentUser();
  if (!profile) {
    return { ok: false, error: 'Sesi tamat. Sila log masuk semula.' };
  }

  const fullName = (input.full_name ?? '').trim();
  if (!fullName) {
    return { ok: false, error: 'Nama penuh murid diperlukan.' };
  }

  if (!(await isClassValid(input.class_id, profile.tenant_id))) {
    return { ok: false, error: 'Kelas yang dipilih tidak sah untuk pusat anda.' };
  }

  // Klien admin memintas RLS — elak rekursi dasar pada jadual `users`.
  const admin = createAdminClient();
  const { error } = await admin.from('students').insert({
    tenant_id: profile.tenant_id,
    class_id: input.class_id,
    full_name: fullName,
    nickname: emptyToNull(input.nickname),
    mykid_number: emptyToNull(input.mykid_number),
    dob: emptyToNull(input.dob),
    gender: input.gender,
    parent_name: emptyToNull(input.parent_name),
    parent_phone: emptyToNull(input.parent_phone),
    special_notes: emptyToNull(input.special_notes),
    photo_url: emptyToNull(input.photo_url),
  });

  if (error) {
    return { ok: false, error: `Gagal menambah murid: ${error.message}` };
  }

  revalidatePath('/admin/students');
  return { ok: true };
}

/** Kemas kini murid sedia ada (disahkan milik tenant pengguna). */
export async function updateStudent(
  studentId: string,
  input: StudentInput
): Promise<StudentActionResult> {
  const profile = await getCurrentUser();
  if (!profile) {
    return { ok: false, error: 'Sesi tamat. Sila log masuk semula.' };
  }

  const fullName = (input.full_name ?? '').trim();
  if (!fullName) {
    return { ok: false, error: 'Nama penuh murid diperlukan.' };
  }

  if (!(await isClassValid(input.class_id, profile.tenant_id))) {
    return { ok: false, error: 'Kelas yang dipilih tidak sah untuk pusat anda.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('students')
    .update({
      class_id: input.class_id,
      full_name: fullName,
      nickname: emptyToNull(input.nickname),
      mykid_number: emptyToNull(input.mykid_number),
      dob: emptyToNull(input.dob),
      gender: input.gender,
      parent_name: emptyToNull(input.parent_name),
      parent_phone: emptyToNull(input.parent_phone),
      special_notes: emptyToNull(input.special_notes),
      photo_url: emptyToNull(input.photo_url),
    })
    .eq('id', studentId)
    .eq('tenant_id', profile.tenant_id);

  if (error) {
    return { ok: false, error: `Gagal mengemas kini murid: ${error.message}` };
  }

  revalidatePath('/admin/students');
  return { ok: true };
}

/** Padam murid (disahkan milik tenant pengguna). */
export async function deleteStudent(
  studentId: string
): Promise<StudentActionResult> {
  const profile = await getCurrentUser();
  if (!profile) {
    return { ok: false, error: 'Sesi tamat. Sila log masuk semula.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('students')
    .delete()
    .eq('id', studentId)
    .eq('tenant_id', profile.tenant_id);

  if (error) {
    return { ok: false, error: `Gagal memadam murid: ${error.message}` };
  }

  revalidatePath('/admin/students');
  return { ok: true };
}
