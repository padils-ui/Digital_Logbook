'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import type { ClassRow } from '@/lib/types';
import type {
  AttendanceDailyChartPoint,
  AttendanceStatus,
  AttendanceSummaryStats,
} from '@/types/attendance';

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

// ── Analitik Kehadiran ──────────────────────────────────────────

/** Parameter analitik kehadiran yang dihantar oleh klien. */
export interface AttendanceAnalyticsParams {
  /** Penapis kelas pilihan (disahkan melalui tenant_id pada pertanyaan). */
  classId?: string | null;
  startDate: string;
  endDate: string;
}

/** Hasil agregasi analitik kehadiran. */
export interface AttendanceAnalyticsResult {
  summary: AttendanceSummaryStats;
  daily: AttendanceDailyChartPoint[];
}

/** Baris kehadiran minimum yang diperlukan untuk agregasi analitik. */
interface AnalyticsAttendanceRow {
  student_id: string;
  date: string;
  status: string | null;
  suhu_tiba: string | null;
  suhu_balik: string | null;
}

/** Nama hari dalam Bahasa Melayu (indeks 0 = Ahad). */
const MALAY_DAY_NAMES = [
  'Ahad',
  'Isnin',
  'Selasa',
  'Rabu',
  'Khamis',
  'Jumaat',
  'Sabtu',
];

/** Singkatan bulan untuk label carta, contoh: '19 Oct'. */
const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Suhu minimum (°C) yang dikira sebagai demam. */
const FEVER_THRESHOLD = 37.5;

/** Had maksimum hari bagi satu julat analitik (mengelakkan julat melampau). */
const MAX_ANALYTICS_DAYS = 366;

/** Tukar nilai suhu (rentetan) kepada nombor; null jika tidak sah. */
function parseSuhu(value: string | null): number | null {
  if (value === null) return null;
  const cleaned = value.trim().replace(',', '.');
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Bundarkan kepada satu tempat perpuluhan. */
function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Bina label harian, contoh: 'Isnin (19 Oct)'. */
function buildDayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  const dayName = MALAY_DAY_NAMES[parsed.getUTCDay()] ?? '';
  const day = parsed.getUTCDate();
  const month = MONTH_ABBREVIATIONS[parsed.getUTCMonth()] ?? '';
  return `${dayName} (${day} ${month})`;
}

/** Senarai tarikh ISO (YYYY-MM-DD) bagi julat inklusif. */
function buildDateRange(startDate: string, endDate: string): string[] {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return [];
  }

  const dates: string[] = [];
  for (
    let i = 0, ms = startMs;
    ms <= endMs && i < MAX_ANALYTICS_DAYS;
    i += 1, ms += 86_400_000
  ) {
    dates.push(new Date(ms).toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Agregasi data analitik kehadiran bagi satu tempoh dan (pilihan) kelas.
 *
 * Keselamatan multi-tenant:
 * - `tenant_id` diambil daripada profil pengguna yang disahkan; ia tidak
 *   pernah diterima daripada input klien.
 * - Setiap pertanyaan ditapis mengikut `tenant_id`.
 * - `classId` hanya bertindak sebagai penapis tambahan; anak diambil dengan
 *   `.eq('tenant_id', …)` terlebih dahulu, jadi kelas daripada tenant lain
 *   akan menghasilkan set anak kosong.
 */
export async function getAttendanceAnalytics({
  classId,
  startDate,
  endDate,
}: AttendanceAnalyticsParams): Promise<AttendanceAnalyticsResult> {
  const emptySummary: AttendanceSummaryStats = {
    totalStudents: 0,
    hadirCount: 0,
    tidakHadirCount: 0,
    lewatCount: 0,
    attendanceRate: 0,
    feverCount: 0,
  };

  try {
    const profile = await getCurrentUser();
    if (!profile) {
      return { summary: emptySummary, daily: [] };
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return { summary: emptySummary, daily: [] };
    }

    const tenantId = profile.tenant_id;
    const dateRange = buildDateRange(startDate, endDate);
    const admin = createAdminClient();

    // ── 1. Anak dalam skop (tenant + kelas pilihan) ──────────────
    let studentQuery = admin
      .from('students')
      .select('id')
      .eq('tenant_id', tenantId);

    if (classId) {
      studentQuery = studentQuery.eq('class_id', classId);
    }

    const { data: students, error: studentError } = await studentQuery;

    if (studentError) {
      console.error('[getAttendanceAnalytics] Ralat anak:', studentError);
      return { summary: emptySummary, daily: [] };
    }

    const studentIds = (students ?? []).map((s) => s.id as string);
    const totalStudents = studentIds.length;

    if (totalStudents === 0) {
      return {
        summary: emptySummary,
        daily: dateRange.map((date) => ({
          date,
          label: buildDayLabel(date),
          hadir: 0,
          tidakHadir: 0,
          lewat: 0,
          avgSuhuTiba: null,
          avgSuhuBalik: null,
        })),
      };
    }

    // ── 2. Rekod kehadiran dalam tempoh ──────────────────────────
    const { data: rows, error: attendanceError } = await admin
      .from('attendance')
      .select('student_id, date, status, suhu_tiba, suhu_balik')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (attendanceError) {
      console.error('[getAttendanceAnalytics] Ralat kehadiran:', attendanceError);
      return { summary: emptySummary, daily: [] };
    }

    const studentIdSet = new Set(studentIds);
    const attendanceRows = ((rows ?? []) as AnalyticsAttendanceRow[]).filter((row) =>
      studentIdSet.has(row.student_id)
    );

    // ── 3. Ringkasan metrik ──────────────────────────────────────
    let hadirCount = 0;
    let tidakHadirCount = 0;
    let lewatCount = 0;
    const feverStudents = new Set<string>();

    attendanceRows.forEach((row) => {
      if (row.status === 'Hadir') hadirCount += 1;
      else if (row.status === 'Tidak Hadir') tidakHadirCount += 1;
      else if (row.status === 'Lewat') lewatCount += 1;

      const suhuTiba = parseSuhu(row.suhu_tiba);
      const suhuBalik = parseSuhu(row.suhu_balik);
      if (
        (suhuTiba !== null && suhuTiba >= FEVER_THRESHOLD) ||
        (suhuBalik !== null && suhuBalik >= FEVER_THRESHOLD)
      ) {
        feverStudents.add(row.student_id);
      }
    });

    const totalRecords = hadirCount + tidakHadirCount + lewatCount;
    const attendanceRate =
      totalRecords > 0
        ? roundOne(((hadirCount + lewatCount) / totalRecords) * 100)
        : 0;

    const summary: AttendanceSummaryStats = {
      totalStudents,
      hadirCount,
      tidakHadirCount,
      lewatCount,
      attendanceRate,
      feverCount: feverStudents.size,
    };

    // ── 4. Agregasi harian untuk carta ───────────────────────────
    interface DayAccumulator {
      hadir: number;
      tidakHadir: number;
      lewat: number;
      suhuTibaSum: number;
      suhuTibaCount: number;
      suhuBalikSum: number;
      suhuBalikCount: number;
    }

    const byDate = new Map<string, DayAccumulator>();

    attendanceRows.forEach((row) => {
      const acc = byDate.get(row.date) ?? {
        hadir: 0,
        tidakHadir: 0,
        lewat: 0,
        suhuTibaSum: 0,
        suhuTibaCount: 0,
        suhuBalikSum: 0,
        suhuBalikCount: 0,
      };

      if (row.status === 'Hadir') acc.hadir += 1;
      else if (row.status === 'Tidak Hadir') acc.tidakHadir += 1;
      else if (row.status === 'Lewat') acc.lewat += 1;

      const suhuTiba = parseSuhu(row.suhu_tiba);
      if (suhuTiba !== null) {
        acc.suhuTibaSum += suhuTiba;
        acc.suhuTibaCount += 1;
      }

      const suhuBalik = parseSuhu(row.suhu_balik);
      if (suhuBalik !== null) {
        acc.suhuBalikSum += suhuBalik;
        acc.suhuBalikCount += 1;
      }

      byDate.set(row.date, acc);
    });

    const daily: AttendanceDailyChartPoint[] = dateRange.map((date) => {
      const acc = byDate.get(date);
      return {
        date,
        label: buildDayLabel(date),
        hadir: acc?.hadir ?? 0,
        tidakHadir: acc?.tidakHadir ?? 0,
        lewat: acc?.lewat ?? 0,
        avgSuhuTiba:
          acc && acc.suhuTibaCount > 0
            ? roundOne(acc.suhuTibaSum / acc.suhuTibaCount)
            : null,
        avgSuhuBalik:
          acc && acc.suhuBalikCount > 0
            ? roundOne(acc.suhuBalikSum / acc.suhuBalikCount)
            : null,
      };
    });

    return { summary, daily };
  } catch (err) {
    console.error('[getAttendanceAnalytics] Ralat tidak dikendalikan:', err);
    return { summary: emptySummary, daily: [] };
  }
}

/**
 * Senarai kelas milik tenant semasa (untuk penapis analitik).
 *
 * Keselamatan: `tenant_id` diambil daripada profil pengguna yang disahkan,
 * bukan daripada input klien.
 */
export async function getTenantClasses(): Promise<
  Pick<ClassRow, 'id' | 'class_name'>[]
> {
  const profile = await getCurrentUser();
  if (!profile?.tenant_id) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('classes')
    .select('id, class_name')
    .eq('tenant_id', profile.tenant_id)
    .order('class_name');

  if (error) {
    console.error('[getTenantClasses] Ralat kelas:', error);
    return [];
  }

  return (data ?? []) as Pick<ClassRow, 'id' | 'class_name'>[];
}
