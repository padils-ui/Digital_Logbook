/**
 * Helper julat tarikh untuk analitik kehadiran.
 *
 * Modul tulen (tanpa 'use client' / 'use server') supaya logik yang sama
 * digunakan oleh komponen klien dan komponen pelayan — memastikan data awal
 * yang dimuatkan di pelayan sepadan dengan preset "Minggu Ini".
 */

/** Julat tarikh pantas yang disediakan pada bar penapis. */
export type AttendanceRangePreset = 'week' | 'month' | 'last30';

/** Julat tarikh inklusif dalam format ISO (YYYY-MM-DD). */
export interface AttendanceDateRange {
  startDate: string;
  endDate: string;
}

/** Tambah sifar di hadapan bagi nilai satu digit. */
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Tukar objek Date (waktu tempatan) kepada tarikh ISO YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

/** Kira julat tarikh bagi preset terpilih (termasuk hari ini). */
export function getPresetRange(
  preset: AttendanceRangePreset
): AttendanceDateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);

  if (preset === 'month') {
    start.setDate(1);
  } else if (preset === 'last30') {
    start.setDate(today.getDate() - 29);
  } else {
    // Minggu bermula pada hari Isnin.
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  }

  return { startDate: toIsoDate(start), endDate: toIsoDate(today) };
}
