'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import type { LogCategory } from '@/lib/log-categories';

export interface SaveLogInput {
  studentIds: string[];
  category: LogCategory;
  logDate: string;
  content: Record<string, unknown>;
  mediaUrls?: string[];
}

export interface SaveLogResult {
  ok: boolean;
  saved?: number;
  error?: string;
}

/**
 * Simpan log harian untuk satu atau lebih murid (mod kelompok).
 *
 * Keselamatan: tenant_id dan teacher_id diambil daripada profil pengguna
 * yang disahkan — BUKAN daripada input klien. Klien admin (service role)
 * digunakan untuk pengesahan murid supaya RLS tidak menyekat pertanyaan.
 */
export async function saveDailyLogs(
  input: SaveLogInput
): Promise<SaveLogResult> {
  const profile = await getCurrentUser();
  if (!profile) {
    return { ok: false, error: 'Sesi tamat. Sila log masuk semula.' };
  }

  if (!input.studentIds.length) {
    return {
      ok: false,
      error: 'Sila pilih sekurang-kurangnya seorang murid.',
    };
  }

  // Gunakan admin client (service role) untuk pengesahan murid supaya
  // RLS tidak menyekat atau menyebabkan ralat rekursi.
  const admin = createAdminClient();

  const { data: validStudents, error: studentError } = await admin
    .from('students')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .in('id', input.studentIds);

  if (studentError) {
    console.error('[saveDailyLogs] Ralat pengesahan murid:', studentError);
    return { ok: false, error: `Gagal mengesahkan murid: ${studentError.message}` };
  }

  const validIds = (validStudents ?? []).map((s) => s.id);
  if (validIds.length === 0) {
    return {
      ok: false,
      error: 'Murid yang dipilih tidak dijumpai dalam pusat anda. Sila muat semula halaman.',
    };
  }

  // Hanya simpan ID murid yang sah (pertahanan berlapis terhadap manipulasi).
  const rows = validIds.map((studentId) => ({
    tenant_id: profile.tenant_id,
    student_id: studentId,
    teacher_id: profile.id,
    log_date: input.logDate,
    category: input.category,
    content: input.content,
    media_urls: input.mediaUrls ?? [],
  }));

  const { error: insertError } = await admin.from('daily_logs').insert(rows);

  if (insertError) {
    console.error('[saveDailyLogs] Ralat sisipan:', insertError);
    return { ok: false, error: `Gagal menyimpan log: ${insertError.message}` };
  }

  revalidatePath('/teacher');
  return { ok: true, saved: rows.length };
}
