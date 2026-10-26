/**
 * Pengiraan tetingkap minggu (Isnin–Jumaat) untuk modul Pemantauan Log.
 *
 * Logik ini dicerminkan daripada `src/inngest/weekly-pentaksiran-cron.ts`
 * supaya tarikh yang dipaparkan di dashboard sepadan dengan tetingkap yang
 * digunakan oleh saluran paip pentaksiran AI.
 *
 * Semua tarikh diwakili sebagai rentetan ISO `YYYY-MM-DD` dan dikira dalam UTC
 * bagi mengelakkan anjakan zon waktu pelayar.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** MYT = UTC+8 (tiada waktu simpanan). */
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

const MONTH_LABELS_MY = [
  'Jan',
  'Feb',
  'Mac',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ogos',
  'Sep',
  'Okt',
  'Nov',
  'Dis',
];

const DAY_LABELS_MY = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

export interface WeekWindow {
  /** Tarikh Isnin. */
  startDate: string;
  /** Tarikh Jumaat. */
  endDate: string;
  /** Lima tarikh bekerja: Isnin hingga Jumaat. */
  days: string[];
  year: number;
  weekNumber: number;
}

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Tukar objek Date kepada rentetan ISO `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Tambah / tolak hari pada tarikh ISO. */
export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return toIsoDate(new Date(date.getTime() + days * DAY_MS));
}

/** Isnin bagi tarikh ISO yang diberikan. */
export function mondayOf(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  const dayOfWeek = date.getUTCDay(); // 0 = Ahad
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return toIsoDate(new Date(date.getTime() - daysSinceMonday * DAY_MS));
}

/** Nombor minggu ISO-8601 (1–53). */
export function getIsoWeekNumber(mondayIso: string): number {
  const parsed = parseIsoDate(mondayIso);
  if (!parsed) return 1;

  const target = new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
  const dayNumber = target.getUTCDay() || 7;
  // Khamis dalam minggu yang sama menentukan tahun/minggu ISO.
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

/** Bina tetingkap Isnin–Jumaat daripada tarikh Isnin. */
export function getWeekWindow(mondayIso: string): WeekWindow {
  const startDate = mondayOf(mondayIso);
  const days = Array.from({ length: 5 }, (_, index) => addDays(startDate, index));
  const parsed = parseIsoDate(startDate);
  const year = parsed ? parsed.getUTCFullYear() : new Date().getUTCFullYear();

  return {
    startDate,
    endDate: days[4],
    days,
    year,
    weekNumber: getIsoWeekNumber(startDate),
  };
}

/** Tarikh hari ini (ISO `YYYY-MM-DD`) mengikut waktu Malaysia. */
export function getTodayIso(now: Date = new Date()): string {
  const myt = new Date(now.getTime() + MYT_OFFSET_MS);
  return toIsoDate(new Date(Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth(), myt.getUTCDate())));
}

/** Isnin bagi minggu semasa mengikut waktu Malaysia. */
export function getCurrentWeekMonday(now: Date = new Date()): string {
  const myt = new Date(now.getTime() + MYT_OFFSET_MS);
  const dayOfWeek = myt.getUTCDay(); // 0 = Ahad
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return toIsoDate(
    new Date(Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth(), myt.getUTCDate() - daysSinceMonday))
  );
}

/**
 * Sahkan parameter `?week=` dan pulangkan tarikh Isnin.
 * Nilai tidak sah jatuh balik kepada minggu semasa.
 */
export function normalizeWeekParam(
  value: string | string[] | undefined,
  now: Date = new Date()
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && parseIsoDate(raw)) return mondayOf(raw);
  return getCurrentWeekMonday(now);
}

/** Anjakan minggu (contoh: -1 minggu lepas). */
export function shiftWeek(mondayIso: string, weeks: number): string {
  return addDays(mondayIso, weeks * 7);
}

/** Label ringkas: `19 Okt 2026`. */
export function formatDateMy(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return `${date.getUTCDate()} ${MONTH_LABELS_MY[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Label hari: `Isnin, 19 Okt`. */
export function formatDayLabel(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return `${DAY_LABELS_MY[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTH_LABELS_MY[date.getUTCMonth()]}`;
}

/** Nama hari sahaja: `Isnin`. */
export function formatDayName(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return DAY_LABELS_MY[date.getUTCDay()];
}

/** Tarikh ringkas tanpa tahun: `19 Okt`. */
export function formatDateShort(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return `${date.getUTCDate()} ${MONTH_LABELS_MY[date.getUTCMonth()]}`;
}

/** Cap masa mengikut waktu Malaysia: `19 Okt 2026, 14:05`. */
export function formatDateTimeMy(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const myt = new Date(date.getTime() + MYT_OFFSET_MS);
  const hours = String(myt.getUTCHours()).padStart(2, '0');
  const minutes = String(myt.getUTCMinutes()).padStart(2, '0');
  return `${myt.getUTCDate()} ${MONTH_LABELS_MY[myt.getUTCMonth()]} ${myt.getUTCFullYear()}, ${hours}:${minutes}`;
}

/** Label julat: `19 Okt – 23 Okt 2026`. */
export function formatWeekRange(window: WeekWindow): string {
  const start = parseIsoDate(window.startDate);
  const end = parseIsoDate(window.endDate);
  if (!start || !end) return `${window.startDate} – ${window.endDate}`;
  return `${start.getUTCDate()} ${MONTH_LABELS_MY[start.getUTCMonth()]} – ${end.getUTCDate()} ${MONTH_LABELS_MY[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}
