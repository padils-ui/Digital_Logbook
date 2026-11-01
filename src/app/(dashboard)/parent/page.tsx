import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Download,
  IdCard,
  Megaphone,
  Pin,
  type LucideIcon,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { WeeklyLogDownload } from '@/components/parent/weekly-log-download';
import {
  formatDateShort,
  formatDateTimeMy,
  formatDayName,
  getCurrentWeekMonday,
  getTodayIso,
} from '@/lib/week-window';
import type {
  Announcement,
  AnnouncementPriority,
  TakwimEventRow,
} from '@/lib/types';
import type { AttendanceRow } from '@/types/attendance';
import { getAttendanceTone } from '@/lib/attendance-tone';

export const metadata: Metadata = { title: 'Papan Pemuka Ibu Bapa' };

/** Ringkasan anak yang dipautkan kepada ibu bapa. */
interface ChildRow {
  id: string;
  full_name: string;
  class_id: string | null;
  photo_url: string | null;
}

/** Satu acara takwim yang telah dinormalkan untuk paparan. */
interface EventView {
  id: string;
  title: string;
  description: string | null;
  date: string;
  type: 'mesyuarat' | 'cuti' | 'aktiviti' | 'lain';
  isHoliday: boolean;
}

/** Gaya sepanduk mengikut keutamaan pengumuman. */
const ANNOUNCEMENT_TONE: Record<AnnouncementPriority, string> = {
  urgent:
    'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/60',
  general:
    'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/60',
};

const EVENT_BADGE: Record<EventView['type'], string> = {
  mesyuarat:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  cuti: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  aktiviti:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  lain: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const EVENT_LABEL: Record<EventView['type'], string> = {
  mesyuarat: 'Mesyuarat',
  cuti: 'Cuti',
  aktiviti: 'Aktiviti',
  lain: 'Acara',
};

/** Bina senarai acara daripada jadual `takwim_events`. */
function mapTakwimRows(rows: TakwimEventRow[]): EventView[] {
  return rows.map((row) => ({
    id: `takwim-${row.id}`,
    title: row.title,
    description: row.description ?? null,
    date: row.event_date,
    type: row.is_holiday ? 'cuti' : row.event_type ?? 'lain',
    isHoliday: Boolean(row.is_holiday),
  }));
}

export default async function ParentDashboardPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');
  if (profile.role !== 'parent') redirect('/dashboard');

  const supabase = createClient();
  const todayIso = getTodayIso();

  // 1. Anak yang dipautkan — kesatuan kedua-dua jadual pautan (RLS menapis).
  const [mapRes, legacyRes] = await Promise.all([
    supabase
      .from('parent_student_map')
      .select('student_id')
      .eq('parent_id', profile.id),
    supabase
      .from('student_parents')
      .select('student_id')
      .eq('parent_id', profile.id),
  ]);

  const linkedIds = Array.from(
    new Set(
      [
        ...((mapRes.data ?? []) as { student_id: string | null }[]),
        ...((legacyRes.data ?? []) as { student_id: string | null }[]),
      ]
        .map((row) => row.student_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const { data: childData } =
    linkedIds.length > 0
      ? await supabase
          .from('students')
          .select('id, full_name, class_id, photo_url')
          .in('id', linkedIds)
          .order('full_name', { ascending: true })
      : { data: [] as ChildRow[] };

  const children = (childData ?? []) as ChildRow[];
  const classIds = Array.from(
    new Set(children.map((child) => child.class_id).filter((id): id is string => Boolean(id)))
  );

  // 2. Data papan pemuka (kehadiran, pengumuman, takwim, kelas, pusat).
  const [attendanceRes, announcementRes, takwimRes, legacyCalendarRes, classRes, settingsRes, tenantRes] =
    await Promise.all([
      children.length > 0
        ? supabase
            .from('attendance')
            .select('id, tenant_id, student_id, date, status, suhu_tiba, suhu_balik, catatan, created_at')
            .in('student_id', children.map((child) => child.id))
            .eq('date', todayIso)
        : Promise.resolve({ data: [] as AttendanceRow[] }),
      supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('takwim_events')
        .select('*')
        .gte('event_date', todayIso)
        .order('event_date', { ascending: true })
        .limit(8),
      supabase
        .from('academic_calendar')
        .select('*')
        .gte('date', todayIso)
        .order('date', { ascending: true })
        .limit(8),
      classIds.length > 0
        ? supabase.from('classes').select('id, class_name').in('id', classIds)
        : Promise.resolve({ data: [] as { id: string; class_name: string }[] }),
      supabase.from('center_settings').select('center_name').maybeSingle(),
      supabase.from('tenants').select('name').maybeSingle(),
    ]);

  const attendanceByStudent = new Map<string, AttendanceRow>();
  for (const row of (attendanceRes.data ?? []) as AttendanceRow[]) {
    if (row.student_id) attendanceByStudent.set(row.student_id, row);
  }

  const classNames = new Map<string, string>();
  for (const row of (classRes.data ?? []) as { id: string; class_name: string }[]) {
    classNames.set(row.id, row.class_name);
  }

  const centerSettings = settingsRes.data as { center_name: string | null } | null;
  const tenant = tenantRes.data as { name: string | null } | null;
  const branchName =
    centerSettings?.center_name || tenant?.name || 'Pusat PAPN';

  // 3. Pengumuman — utamakan pengumuman tersemat, tapis mengikut kelas anak.
  const announcements = ((announcementRes.data ?? []) as Announcement[])
    .filter(
      (item) =>
        !item.target_class_id ||
        classIds.length === 0 ||
        classIds.includes(item.target_class_id)
    )
    .slice(0, 5);

  // 4. Takwim — `takwim_events` diutamakan, `academic_calendar` sebagai sandaran.
  const takwimRows = (takwimRes.data ?? []) as TakwimEventRow[];
  let events: EventView[] = mapTakwimRows(takwimRows);

  if (events.length === 0) {
    events = ((legacyCalendarRes.data ?? []) as {
      id: string;
      date: string;
      event_name: string;
      is_holiday: boolean;
    }[]).map((row) => ({
      id: `calendar-${row.id}`,
      title: row.event_name,
      description: null,
      date: row.date,
      type: row.is_holiday ? 'cuti' : 'lain',
      isHoliday: Boolean(row.is_holiday),
    }));
  }

  events = events.slice(0, 6);

  const quickActions: {
    href: string;
    label: string;
    description: string;
    icon: LucideIcon;
    tone: string;
  }[] = [
    {
      href: '/parent/today',
      label: 'Aktiviti Hari Ini',
      description: 'Lihat garis masa aktiviti, makanan dan tidur anak.',
      icon: Activity,
      tone: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
    },
    {
      href: '#muat-turun-log',
      label: 'Muat Turun Log Mingguan',
      description: 'Arkib log harian dan ulasan ibu bapa.',
      icon: Download,
      tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      href: '/parent/profile',
      label: 'Kad Profil Anak',
      description: 'Maklumat peribadi, kesihatan dan kecemasan.',
      icon: IdCard,
      tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Pengepala papan pemuka */}
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          Papan Pemuka Ibu Bapa
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
          Selamat Datang, {profile.full_name}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {branchName} · {formatDayName(todayIso)}, {formatDateShort(todayIso)}
        </p>
      </header>

      {/* ── Muat Turun Log Mingguan (PDF) ────────────────────── */}
      <section aria-labelledby="muat-turun-log">
        <h2
          id="muat-turun-log"
          className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Muat Turun Log Mingguan
        </h2>
        <WeeklyLogDownload
          students={children.map((child) => ({ id: child.id, name: child.full_name }))}
          defaultWeekStart={getCurrentWeekMonday()}
        />
      </section>

      {/* ── 1. Ringkasan Anak ───────────────────────────────── */}
      <section aria-labelledby="ringkasan-anak">
        <div className="mb-2 flex items-center justify-between">
          <h2
            id="ringkasan-anak"
            className="text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Ringkasan Anak
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {children.length} anak dipautkan
          </span>
        </div>

        {children.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Tiada anak dipautkan ke akaun anda.
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Sila hubungi pentadbir pusat PAPN anda untuk pautan rekod anak.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {children.map((child) => {
              const attendance = attendanceByStudent.get(child.id) ?? null;
              const tone = getAttendanceTone(attendance?.status ?? null);
              const className = child.class_id ? classNames.get(child.class_id) : null;
              const initials = child.full_name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? '')
                .join('');

              return (
                <article
                  key={child.id}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {child.photo_url ? (
                        <img
                          src={child.photo_url}
                          alt={child.full_name}
                          referrerPolicy="no-referrer"
                          className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                        />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          {initials || '?'}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                          {child.full_name}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {className ?? 'Kelas belum ditetapkan'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}
                    >
                      {attendance?.status ?? 'Tiada Rekod'}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    {tone.hint}
                  </p>

                  <Link
                    href={`/parent/today?student=${child.id}`}
                    className="btn-primary mt-3 w-full text-xs"
                  >
                    <Activity className="h-4 w-4" aria-hidden />
                    Lihat Aktiviti Hari Ini
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 2. Pengumuman Terkini ───────────────────────────── */}
      <section aria-labelledby="pengumuman-terkini">
        <div className="mb-2 flex items-center justify-between">
          <h2
            id="pengumuman-terkini"
            className="text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Pengumuman Terkini
          </h2>
        </div>

        {announcements.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tiada pengumuman buat masa ini.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((item) => {
              const priority: AnnouncementPriority =
                item.priority ?? (item.is_pinned ? 'urgent' : 'general');
              const isUrgent = priority === 'urgent';
              const Icon = isUrgent ? AlertTriangle : Megaphone;

              return (
                <article
                  key={item.id}
                  className={`rounded-xl border p-4 shadow-sm ${ANNOUNCEMENT_TONE[priority]}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isUrgent
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200'
                      }`}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.is_pinned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-900/40 dark:text-red-200">
                            <Pin className="h-3 w-3" aria-hidden />
                            Disemat
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            isUrgent
                              ? 'bg-red-600 text-white'
                              : 'bg-sky-600 text-white'
                          }`}
                        >
                          {isUrgent ? 'Penting' : 'Umum'}
                        </span>
                        {item.category ? (
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                            {item.category}
                          </span>
                        ) : null}
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateTimeMy(item.created_at)}
                        </span>
                      </div>
                      <h3
                        className={`mt-1 text-sm font-bold ${
                          isUrgent
                            ? 'text-red-900 dark:text-red-100'
                            : 'text-sky-900 dark:text-sky-100'
                        }`}
                      >
                        {item.title}
                      </h3>
                      <p
                        className={`mt-1 whitespace-pre-line text-xs leading-relaxed ${
                          isUrgent
                            ? 'text-red-800 dark:text-red-200'
                            : 'text-sky-800 dark:text-sky-200'
                        }`}
                      >
                        {item.content}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 3. Takwim & Acara PAPN ──────────────────────────── */}
      <section aria-labelledby="takwim-acara">
        <div className="mb-2 flex items-center justify-between">
          <h2
            id="takwim-acara"
            className="text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Takwim &amp; Acara PAPN
          </h2>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tiada acara akan datang buat masa ini.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {event.title}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${EVENT_BADGE[event.type]}`}
                    >
                      {EVENT_LABEL[event.type]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {formatDayName(event.date)}, {formatDateShort(event.date)}
                  </p>
                  {event.description ? (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {event.description}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 4. Pautan Pantas ────────────────────────────────── */}
      <section aria-labelledby="pautan-pantas">
        <h2
          id="pautan-pantas"
          className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Pautan Pantas
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex min-h-touch items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.tone}`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
                    {action.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    {action.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
