/**
 * Gaya lencana dan teks bantuan bagi status kehadiran harian.
 *
 * Digunakan oleh papan pemuka ibu bapa untuk memaparkan status anak
 * (Hadir / Lewat / Tidak Hadir) secara konsisten dalam mod cerah dan gelap.
 */

export interface AttendanceTone {
  /** Kelas Tailwind untuk lencana status. */
  badge: string;
  /** Ayat pendek yang menerangkan status kepada ibu bapa. */
  hint: string;
}

const TONES: Record<string, AttendanceTone> = {
  Hadir: {
    badge:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    hint: 'Telah didaftar masuk ke pusat hari ini.',
  },
  Lewat: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    hint: 'Didaftar masuk lewat ke pusat hari ini.',
  },
  'Tidak Hadir': {
    badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    hint: 'Tidak hadir ke pusat hari ini.',
  },
};

const NO_RECORD: AttendanceTone = {
  badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  hint: 'Tiada rekod kehadiran untuk hari ini.',
};

/** Pulangkan gaya lencana + teks bantuan bagi sesuatu status kehadiran. */
export function getAttendanceTone(status: string | null): AttendanceTone {
  if (!status) return NO_RECORD;
  return TONES[status] ?? NO_RECORD;
}
