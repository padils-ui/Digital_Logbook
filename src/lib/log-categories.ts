import type { LucideIcon } from 'lucide-react';
import { BookOpen, Moon, Stethoscope, UtensilsCrossed } from 'lucide-react';

/** Empat kategori log harian PAPN. */
export type LogCategory =
  | 'child_activity'
  | 'meals'
  | 'sleep'
  | 'health';

/**
 * Chip tindakan pintar — menetapkan nilai tertentu pada medan borang.
 * Setiap chip membawa peta `fieldValues` yang akan dimuatkan ke state borang
 * apabila diklik, mengatasi nilai sedia ada bagi medan yang dinyatakan sahaja.
 */
export interface ChipAction {
  label: string;
  fieldValues: Record<string, string>;
}

export interface LogCategoryDef {
  value: LogCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Warna Tailwind untuk tab aktif. */
  tone: string;
  chips: ChipAction[];
  fields: LogField[];
}

export interface LogField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'time' | 'image';
  placeholder?: string;
  options?: string[];
  suffix?: string;
  /** Kumpulan seksyen (digunakan untuk kluster Aktiviti Anak). */
  section?: string;
}

/** Pilihan tahap penglibatan anak — dikongsi oleh tiga kluster aktiviti. */
const PARTICIPATION_OPTIONS = [
  'Sangat aktif',
  'Aktif',
  'Sederhana',
  'Perlu bimbingan',
];

/**
 * Definisi lengkap 4 kategori log harian PAPN.
 * Chip pantas menggunakan istilah Bahasa Melayu baku (KPM).
 */
export const LOG_CATEGORIES: LogCategoryDef[] = [
  {
    value: 'child_activity',
    label: 'Aktiviti Anak',
    description: 'Aktiviti pembelajaran, perkembangan dan aktiviti luar',
    icon: BookOpen,
    tone: 'bg-brand-600',
    chips: [
      { label: 'Mengenal huruf A-Z', fieldValues: { aktiviti_bebas: 'Mengenal huruf A-Z', penglibatan_bebas: 'Aktif' } },
      { label: 'Menyanyi lagu kanak-kanak', fieldValues: { aktiviti_bebas: 'Menyanyi lagu kanak-kanak', penglibatan_bebas: 'Sangat aktif' } },
      { label: 'Aktiviti mewarna', fieldValues: { aktiviti_bebas: 'Aktiviti mewarna', penglibatan_bebas: 'Aktif' } },
      { label: 'Bermain di taman', fieldValues: { aktiviti_luar: 'Bermain di taman', penglibatan_luar: 'Sangat aktif' } },
      { label: 'Bermain bola', fieldValues: { aktiviti_luar: 'Bermain bola', penglibatan_luar: 'Aktif' } },
      { label: 'Senaman pagi', fieldValues: { aktiviti_luar: 'Senaman pagi', penglibatan_luar: 'Aktif' } },
      { label: 'Aktiviti PERMATA', fieldValues: { aktiviti_permata: 'Aktiviti PERMATA', penglibatan_permata: 'Aktif' } },
    ],
    fields: [
      { section: 'Aktiviti Bebas', name: 'aktiviti_bebas', label: 'Aktiviti', type: 'text', placeholder: 'Contoh: Bermain blok' },
      { section: 'Aktiviti Bebas', name: 'penglibatan_bebas', label: 'Penglibatan', type: 'select', options: PARTICIPATION_OPTIONS },
      { section: 'Aktiviti Bebas', name: 'foto_bebas', label: 'Gambar / Foto', type: 'image' },
      { section: 'Aktiviti Luar', name: 'aktiviti_luar', label: 'Aktiviti', type: 'text', placeholder: 'Contoh: Bermain di taman' },
      { section: 'Aktiviti Luar', name: 'penglibatan_luar', label: 'Penglibatan', type: 'select', options: PARTICIPATION_OPTIONS },
      { section: 'Aktiviti Luar', name: 'foto_luar', label: 'Gambar / Foto', type: 'image' },
      { section: 'Aktiviti PERMATA', name: 'aktiviti_permata', label: 'Aktiviti', type: 'text', placeholder: 'Contoh: Aktiviti PERMATA' },
      { section: 'Aktiviti PERMATA', name: 'penglibatan_permata', label: 'Penglibatan', type: 'select', options: PARTICIPATION_OPTIONS },
      { section: 'Aktiviti PERMATA', name: 'foto_permata', label: 'Gambar / Foto', type: 'image' },
      { name: 'notes', label: 'Catatan Keseluruhan', type: 'textarea', placeholder: 'Catatan keseluruhan aktiviti hari ini…' },
    ],
  },
  {
    value: 'meals',
    label: 'Makanan',
    description: 'Pengambilan makanan harian',
    icon: UtensilsCrossed,
    tone: 'bg-emerald-600',
    chips: [
      { label: 'Makan habis', fieldValues: { appetite: 'Makan habis', notes: 'Makan habis dengan baik.' } },
      { label: 'Makan separuh', fieldValues: { appetite: 'Makan separuh', notes: 'Makan separuh hidangan.' } },
      { label: 'Tidak mahu makan', fieldValues: { appetite: 'Tidak mahu makan', notes: 'Anak tidak mahu makan.' } },
      { label: 'Minum susu habis', fieldValues: { appetite: 'Makan habis', notes: 'Minum susu habis sepenuhnya.' } },
      { label: 'Makan buah', fieldValues: { notes: 'Anak makan buah dengan baik.' } },
    ],
    fields: [
      { name: 'appetite', label: 'Selera', type: 'select', options: ['Makan habis', 'Makan separuh', 'Tidak mahu makan'] },
      { name: 'notes', label: 'Catatan', type: 'textarea', placeholder: 'Contoh: Makan habis, tambah nasi' },
    ],
  },
  {
    value: 'sleep',
    label: 'Tidur',
    description: 'Waktu rehat dan tidur',
    icon: Moon,
    tone: 'bg-indigo-600',
    chips: [
      { label: 'Tidur 1 jam', fieldValues: { duration: '1', quality: 'Tidur lena' } },
      { label: 'Tidur 2 jam', fieldValues: { duration: '2', quality: 'Tidur lena' } },
      { label: 'Tidur lena', fieldValues: { quality: 'Tidur lena' } },
      { label: 'Sukar tidur', fieldValues: { quality: 'Sukar tidur', notes: 'Anak sukar tidur.' } },
      { label: 'Bangun awal', fieldValues: { quality: 'Bangun awal', notes: 'Anak bangun lebih awal dari biasa.' } },
    ],
    fields: [
      { name: 'duration', label: 'Tempoh Tidur', type: 'number', suffix: 'jam' },
      { name: 'quality', label: 'Kualiti Tidur', type: 'select', options: ['Tidur lena', 'Tidur sederhana', 'Sukar tidur', 'Bangun awal'] },
      { name: 'notes', label: 'Catatan', type: 'textarea', placeholder: 'Catatan tambahan…' },
    ],
  },
  {
    value: 'health',
    label: 'Tingkah Laku',
    description: 'Tingkah laku, kemalangan, kecederaan dan kesihatan anak',
    icon: Stethoscope,
    tone: 'bg-rose-600',
    chips: [
      { label: 'Tiada Kemalangan', fieldValues: { kemalangan: 'Tiada' } },
      { label: 'Tiada Kecederaan', fieldValues: { kecederaan: 'Tiada' } },
      { label: 'Sihat', fieldValues: { kesihatan: 'Sihat' } },
    ],
    fields: [
      { name: 'tingkah_laku', label: 'Tingkah Laku', type: 'textarea', placeholder: 'Catatan tingkah laku anak hari ini…' },
      { name: 'kemalangan', label: 'Kemalangan', type: 'text', placeholder: 'Contoh: Tiada' },
      { name: 'kecederaan', label: 'Kecederaan', type: 'text', placeholder: 'Contoh: Tiada' },
      { name: 'kesihatan', label: 'Kesihatan', type: 'text', placeholder: 'Contoh: Sihat' },
    ],
  },
];

/** Cari definisi kategori berdasarkan nilai. */
export function getCategory(value: LogCategory): LogCategoryDef {
  return LOG_CATEGORIES.find((c) => c.value === value) ?? LOG_CATEGORIES[0];
}

/** Kira umur dalam tahun daripada tarikh lahir. */
export function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}
