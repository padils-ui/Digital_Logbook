/**
 * Definisi jenis untuk jadual `attendance`.
 *
 * Jadual ini mengasingkan rekod kehadiran harian anak (termasuk suhu tiba /
 * pulang) daripada jadual `daily_logs`.
 */

/** Status kehadiran yang sah. */
export type AttendanceStatus = 'Hadir' | 'Tidak Hadir' | 'Lewat';

/** Satu baris penuh daripada jadual `attendance`. */
export interface AttendanceRow {
  id: string;
  tenant_id: string;
  student_id: string;
  date: string;
  status: string | null;
  suhu_tiba: string | null;
  suhu_balik: string | null;
  catatan: string | null;
  created_at: string;
}

/** Input untuk menyisipkan rekod kehadiran baharu. */
export interface AttendanceInput {
  tenant_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  suhu_tiba?: string | null;
  suhu_balik?: string | null;
  catatan?: string | null;
}

/** Ringkasan metrik analitik kehadiran bagi satu tempoh. */
export interface AttendanceSummaryStats {
  /** Jumlah anak berdaftar dalam skop (tenant / kelas). */
  totalStudents: number;
  hadirCount: number;
  tidakHadirCount: number;
  lewatCount: number;
  /** Peratus kehadiran keseluruhan: (Hadir + Lewat) / jumlah rekod × 100. */
  attendanceRate: number;
  /** Bilangan anak unik dengan suhu ≥ 37.5°C (tiba atau balik). */
  feverCount: number;
}

/** Satu titik data harian untuk carta Recharts. */
export interface AttendanceDailyChartPoint {
  /** Tarikh ISO (YYYY-MM-DD). */
  date: string;
  /** Label paparan, contoh: 'Isnin (19 Oct)'. */
  label: string;
  hadir: number;
  tidakHadir: number;
  lewat: number;
  avgSuhuTiba: number | null;
  avgSuhuBalik: number | null;
}
