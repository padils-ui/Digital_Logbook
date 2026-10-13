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
