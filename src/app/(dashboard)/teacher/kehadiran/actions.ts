'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import type { AttendanceStatus } from '@/types/attendance';

/** Satu rekod kehadiran yang dihantar daripada klien. */
export interface AttendanceRecordInput {
  student_id: string;
  status: AttendanceStatus;
  suhu_tiba?: string | null;
  suhu_balik?: string | null;
  catatan?: string | null;
}

/** Hasil operasi simpan kehadiran. */
export interface AttendanceActionResult {
  ok: boolean;
  saved?: number;
  error?: string;
}

/** Status kehadiran yang sah. */
const VALID_STATUSES: AttendanceStatus[] = ['Hadir', 'Tidak Hadir', 'Lewat'];

/** Buang rentetan kosong menjadi null. */
function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Normalkan input suhu: buang unit "°C", aksara ruang, dan tukar koma
 * perpuluhan kepada titik. Memulangkan null jika tiada angka.
 */
function normalizeSuhu(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[,]/g, '.').replace(/[^0-9.]/g, '');
  return cleaned.length ? cleaned : null;
}

/** Sahkan status; pulangkan 'Hadir' sebagai lalai bagi nilai tidak sah. */
function normalizeStatus(value: AttendanceStatus | null | undefined): AttendanceStatus {
  return value && VALID_STATUSES.includes(value) ? value : 'Hadir';
}

/** Sahkan format tarikh ISO (YYYY-MM-DD). */
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}

/**
 * Simpan (upsert) satu rekod kehadiran bagi seorang anak pada tarikh tertentu.
 *
 * Keselamatan: tenant_id diambil daripada profil pengguna yang disahkan —
 * BUKAN daripada input klien. Anak disahkan milik tenant sebelum disimpan.
 */
export async function saveAttendanceRecord(
  studentId: string,
  date: string,
  record: Omit<AttendanceRecordInput, 'student_id'>
): Promise<AttendanceActionResult> {
  return saveBatchAttendance(date, [{ ...record, student_id: studentId }]);
}

/**
 * Simpan (upsert) sekumpulan rekod kehadiran bagi satu tarikh dalam satu
 * operasi. Digunakan oleh borang kehadiran kelompok (batch).
 *
 * Upsert menggunakan kunci konflik `(tenant_id, student_id, date)`, yang
 * memerlukan indeks unik `ux_attendance_tenant_student_date` pada jadual
 * `attendance` (lihat migrasi).
 */
export async function saveBatchAttendance(
  date: string,
  records: AttendanceRecordInput[]
): Promise<AttendanceActionResult> {
  try {
    const profile = await getCurrentUser();
    if (!profile) {
      return { ok: false, error: 'Sesi tamat. Sila log masuk semula.' };
    }

    if (!isValidDate(date)) {
      return { ok: false, error: 'Tarikh tidak sah.' };
    }

    if (!Array.isArray(records) || records.length === 0) {
      return { ok: false, error: 'Tiada rekod kehadiran untuk disimpan.' };
    }

    const admin = createAdminClient();

    // ── 1. Sahkan anak milik tenant ini ──────────────────────────
    const studentIds = Array.from(
      new Set(records.map((r) => r.student_id).filter(Boolean))
    );

    const { data: validStudents, error: studentError } = await admin
      .from('students')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .in('id', studentIds);

    if (studentError) {
      console.error('[saveBatchAttendance] Ralat pengesahan anak:', studentError);
      return {
        ok: false,
        error: `Gagal mengesahkan anak: ${studentError.message}`,
      };
    }

    const validIds = new Set((validStudents ?? []).map((s) => s.id));

    // ── 2. Bina baris yang sah sahaja (buang anak bukan milik tenant) ──
    const rows = records
      .filter((r) => validIds.has(r.student_id))
      .map((r) => ({
        tenant_id: profile.tenant_id,
        student_id: r.student_id,
        date,
        status: normalizeStatus(r.status),
        suhu_tiba: normalizeSuhu(r.suhu_tiba),
        suhu_balik: normalizeSuhu(r.suhu_balik),
        catatan: emptyToNull(r.catatan),
      }));

    if (rows.length === 0) {
      return {
        ok: false,
        error: 'Tiada anak yang sah untuk disimpan dalam pusat anda.',
      };
    }

    // ── 3. Upsert ke jadual attendance ───────────────────────────
    const { error: upsertError } = await admin
      .from('attendance')
      .upsert(rows, { onConflict: 'tenant_id,student_id,date' });

    if (upsertError) {
      console.error('[saveBatchAttendance] Ralat upsert:', upsertError);
      return { ok: false, error: `Gagal menyimpan kehadiran: ${upsertError.message}` };
    }

    revalidatePath('/teacher/kehadiran');
    return { ok: true, saved: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ralat tidak diketahui.';
    console.error('[saveBatchAttendance] Ralat tidak dikendalikan:', err);
    return { ok: false, error: message };
  }
}
