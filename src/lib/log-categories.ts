import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Moon,
  Stethoscope,
  Thermometer,
  UtensilsCrossed,
} from 'lucide-react';

/** Lima kategori log harian PAPN. */
export type LogCategory =
  | 'child_activity'
  | 'meals'
  | 'sleep'
  | 'attendance'
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
  type: 'text' | 'textarea' | 'number' | 'select' | 'time';
  placeholder?: string;
  options?: string[];
  suffix?: string;
}

/**
 * Definisi lengkap 5 kategori log harian PAPN.
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
      { label: 'Mengenal huruf A-Z', fieldValues: { activity: 'Mengenal huruf A-Z', participation: 'Aktif' } },
      { label: 'Menyanyi lagu kanak-kanak', fieldValues: { activity: 'Menyanyi lagu kanak-kanak', participation: 'Sangat aktif' } },
      { label: 'Aktiviti mewarna', fieldValues: { activity: 'Aktiviti mewarna', participation: 'Aktif' } },
      { label: 'Menyusun blok', fieldValues: { activity: 'Menyusun blok', participation: 'Aktif' } },
      { label: 'Bercerita bersama rakan', fieldValues: { activity: 'Bercerita bersama rakan', participation: 'Sangat aktif' } },
      { label: 'Bermain di taman', fieldValues: { activity: 'Bermain di taman', participation: 'Sangat aktif', duration: '30' } },
      { label: 'Bermain bola', fieldValues: { activity: 'Bermain bola', participation: 'Aktif', duration: '30' } },
      { label: 'Senaman pagi', fieldValues: { activity: 'Senaman pagi', participation: 'Aktif', duration: '15' } },
    ],
    fields: [
      { name: 'activity', label: 'Aktiviti', type: 'text', placeholder: 'Contoh: Mengenal huruf A-Z' },
      { name: 'participation', label: 'Penglibatan', type: 'select', options: ['Sangat aktif', 'Aktif', 'Sederhana', 'Perlu bimbingan'] },
      { name: 'duration', label: 'Tempoh', type: 'number', suffix: 'minit' },
      { name: 'notes', label: 'Catatan', type: 'textarea', placeholder: 'Catatan tambahan…' },
    ],
  },
  {
    value: 'meals',
    label: 'Makanan',
    description: 'Waktu makan dan pengambilan makanan',
    icon: UtensilsCrossed,
    tone: 'bg-emerald-600',
    chips: [
      { label: 'Makan habis', fieldValues: { appetite: 'Makan habis', notes: 'Makan habis dengan baik.' } },
      { label: 'Makan separuh', fieldValues: { appetite: 'Makan separuh', notes: 'Makan separuh hidangan.' } },
      { label: 'Tidak mahu makan', fieldValues: { appetite: 'Tidak mahu makan', notes: 'Murid tidak mahu makan.' } },
      { label: 'Minum susu habis', fieldValues: { appetite: 'Makan habis', notes: 'Minum susu habis sepenuhnya.' } },
      { label: 'Makan buah', fieldValues: { notes: 'Murid makan buah dengan baik.' } },
    ],
    fields: [
      { name: 'meal', label: 'Waktu Makan', type: 'select', options: ['Sarapan', 'Minum pagi', 'Makan tengah hari', 'Minum petang'] },
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
      { label: 'Sukar tidur', fieldValues: { quality: 'Sukar tidur', notes: 'Murid sukar tidur.' } },
      { label: 'Bangun awal', fieldValues: { quality: 'Bangun awal', notes: 'Murid bangun lebih awal dari biasa.' } },
    ],
    fields: [
      { name: 'duration', label: 'Tempoh Tidur', type: 'number', suffix: 'jam' },
      { name: 'quality', label: 'Kualiti Tidur', type: 'select', options: ['Tidur lena', 'Tidur sederhana', 'Sukar tidur', 'Bangun awal'] },
      { name: 'notes', label: 'Catatan', type: 'textarea', placeholder: 'Catatan tambahan…' },
    ],
  },
  {
    value: 'attendance',
    label: 'Kehadiran / Suhu',
    description: 'Kehadiran harian dan suhu badan',
    icon: Thermometer,
    tone: 'bg-cyan-600',
    chips: [
      { label: 'Hadir', fieldValues: { status: 'Hadir' } },
      { label: 'Suhu 36.5°C', fieldValues: { status: 'Hadir', temperature: '36.5' } },
      { label: 'Suhu 37.0°C', fieldValues: { status: 'Hadir', temperature: '37.0' } },
      { label: 'Suhu 37.5°C', fieldValues: { status: 'Hadir', temperature: '37.5', notes: 'Suhu sedikit tinggi — pantau.' } },
      { label: 'Tidak hadir', fieldValues: { status: 'Tidak hadir' } },
    ],
    fields: [
      { name: 'status', label: 'Status Kehadiran', type: 'select', options: ['Hadir', 'Tidak hadir', 'Lewat', 'Bersebab'] },
      { name: 'temperature', label: 'Suhu Badan', type: 'number', suffix: '°C' },
      { name: 'notes', label: 'Catatan', type: 'textarea', placeholder: 'Catatan tambahan…' },
    ],
  },
  {
    value: 'health',
    label: 'Kesihatan / Ubat',
    description: 'Ubat, kesihatan dan rawatan',
    icon: Stethoscope,
    tone: 'bg-rose-600',
    chips: [
      { label: 'Ubat diberi', fieldValues: { condition: 'Sakit', notes: 'Ubat telah diberikan mengikut arahan.' } },
      { label: 'Batuk', fieldValues: { condition: 'Batuk', notes: 'Murid mengalami batuk.' } },
      { label: 'Selesema', fieldValues: { condition: 'Selesema', notes: 'Murid mengalami selesema.' } },
      { label: 'Demam', fieldValues: { condition: 'Demam', notes: 'Murid demam — ibu bapa dimaklumkan.' } },
      { label: 'Tiada masalah kesihatan', fieldValues: { condition: 'Tiada masalah', notes: 'Murid sihat hari ini.' } },
    ],
    fields: [
      { name: 'condition', label: 'Keadaan', type: 'text', placeholder: 'Contoh: Batuk dan selesema' },
      { name: 'medicine', label: 'Ubat Diberi', type: 'text', placeholder: 'Contoh: Paracetamol 5ml' },
      { name: 'notes', label: 'Catatan', type: 'textarea', placeholder: 'Catatan tambahan…' },
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
