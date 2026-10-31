import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  Clock,
  Moon,
  Smile,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { calculateAge } from '@/lib/log-categories';
import { formatDateMy, formatDayLabel, getTodayIso } from '@/lib/week-window';
import { ActivityFilter } from '@/components/parent/activity-filter';
import { ActivityTimeline } from '@/components/parent/activity-timeline';
import type { ActivityTimelineEntry, ActivityTimelineKind } from '@/lib/types';
import type { AttendanceRow } from '@/types/attendance';

export const metadata: Metadata = { title: 'Aktiviti Hari Ini' };

/** Ringkasan anak yang dipautkan kepada ibu bapa. */
interface ChildRow {
  id: string;
  full_name: string;
  class_id: string | null;
  dob: string | null;
  photo_url: string | null;
}

/** Satu baris `daily_logs` yang diperlukan oleh paparan ini. */
interface LogRow {
  id: string;
  category: string;
  content: Record<string, unknown> | null;
  media_urls: string[] | null;
  created_at: string;
}

/** Satu baris `incident_reports`. */
interface IncidentRow {
  id: string;
  description: string | null;
  action_taken: string | null;
  media_urls: string[] | null;
  incident_time: string | null;
  created_at: string;
  acknowledged_by_parent: boolean | null;
}

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Pemetaan kategori `daily_logs` kepada jenis entri garis masa. */
const CATEGORY_KIND: Record<string, ActivityTimelineKind> = {
  aktiviti_anak: 'activity',
  makanan: 'meal',
  tidur: 'sleep',
  kesihatan_ubat: 'health',
};

const CATEGORY_TITLE: Record<string, string> = {
  aktiviti_anak: 'Aktiviti Anak',
  makanan: 'Makanan',
  tidur: 'Tidur',
  kesihatan_ubat: 'Kesihatan / Ubat',
};

/** Medan `content` yang dipaparkan sebagai cip butiran mengikut kategori. */
const CONTENT_FIELDS: Record<string, { key: string; label: string; suffix?: string }[]> = {
  aktiviti_anak: [
    { key: 'aktiviti_bebas', label: 'Aktiviti Bebas' },
    { key: 'penglibatan_bebas', label: 'Penglibatan Bebas' },
    { key: 'aktiviti_luar', label: 'Aktiviti Luar' },
    { key: 'penglibatan_luar', label: 'Penglibatan Luar' },
    { key: 'aktiviti_permata', label: 'Aktiviti PERMATA' },
    { key: 'penglibatan_permata', label: 'Penglibatan PERMATA' },
  ],
  makanan: [{ key: 'appetite', label: 'Selera Makan' }],
  tidur: [
    { key: 'duration', label: 'Tempoh', suffix: 'jam' },
    { key: 'quality', label: 'Kualiti Tidur' },
  ],
  kesihatan_ubat: [
    { key: 'tingkah_laku', label: 'Tingkah Laku' },
    { key: 'kemalangan', label: 'Kemalangan' },
    { key: 'kecederaan', label: 'Kecederaan' },
    { key: 'kesihatan', label: 'Kesihatan' },
  ],
};

/** Tukar nilai `content` kepada teks yang boleh dipaparkan. */
function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/** Waktu Malaysia `HH:mm` daripada cap masa ISO. */
function formatTimeMy(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const myt = new Date(date.getTime() + MYT_OFFSET_MS);
  return `${String(myt.getUTCHours()).padStart(2, '0')}:${String(
    myt.getUTCMinutes()
  ).padStart(2, '0')}`;
}

/** Tarikh ISO `YYYY-MM-DD` mengikut waktu Malaysia. */
function mytDayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Bina cip butiran daripada `content` mengikut kategori log. */
function buildDetails(log: LogRow): { label: string; value: string }[] {
  const content = log.content ?? {};
  const fields = CONTENT_FIELDS[log.category] ?? [];
  const details: { label: string; value: string }[] = [];

  for (const field of fields) {
    const value = text(content[field.key]);
    if (value) {
      details.push({
        label: field.label,
        value: field.suffix ? `${value} ${field.suffix}` : value,
      });
    }
  }

  return details;
}

export default async function ParentTodayPage({
  searchParams,
}: {
  searchParams: { student?: string; date?: string };
}) {
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

  if (linkedIds.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Tiada anak dipautkan ke akaun anda.
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sila hubungi pentadbir pusat PAPN anda untuk pautan rekod anak.
        </p>
      </div>
    );
  }

  const { data: childData } = await supabase
    .from('students')
    .select('id, full_name, class_id, dob, photo_url')
    .in('id', linkedIds)
    .order('full_name', { ascending: true });

  const children = (childData ?? []) as ChildRow[];

  if (children.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Rekod anak tidak dapat diakses.
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sila hubungi pentadbir pusat PAPN anda.
        </p>
      </div>
    );
  }

  // 2. Selesaikan anak + tarikh yang dipilih, kemudian normalkan URL.
  const requestedStudentId =
    typeof searchParams.student === 'string' ? searchParams.student : '';
  const requestedDate =
    typeof searchParams.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : todayIso;

  const selected =
    children.find((child) => child.id === requestedStudentId) ?? children[0];

  if (
    searchParams.student !== selected.id ||
    searchParams.date !== requestedDate
  ) {
    redirect(`/parent/today?student=${selected.id}&date=${requestedDate}`);
  }

  const day = requestedDate;

  // 3. Data harian anak terpilih (klien RLS — tiada akses silang penyewa).
  const [attendanceRes, logsRes, classRes, settingsRes, tenantRes] =
    await Promise.all([
      supabase
        .from('attendance')
        .select(
          'id, tenant_id, student_id, date, status, suhu_tiba, suhu_balik, catatan, created_at'
        )
        .eq('student_id', selected.id)
        .eq('date', day)
        .maybeSingle(),
      supabase
        .from('daily_logs')
        .select('id, category, content, media_urls, created_at')
        .eq('student_id', selected.id)
        .eq('log_date', day)
        .order('created_at', { ascending: true }),
      selected.class_id
        ? supabase
            .from('classes')
            .select('class_name')
            .eq('id', selected.class_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('center_settings').select('center_name').maybeSingle(),
      supabase.from('tenants').select('name, app_name').maybeSingle(),
    ]);

  const attendance = (attendanceRes.data ?? null) as AttendanceRow | null;
  const logs = (logsRes.data ?? []) as LogRow[];
  const className =
    (classRes.data as { class_name: string | null } | null)?.class_name ?? null;

  const centerSettings = settingsRes.data as { center_name: string | null } | null;
  const tenant = tenantRes.data as {
    name: string | null;
    app_name: string | null;
  } | null;
  const branchName =
    centerSettings?.center_name ||
    tenant?.app_name ||
    tenant?.name ||
    'Pusat PAPN';

  // 4. Laporan insiden — usaha terbaik (RLS ibu bapa belum disahkan).
  let incidents: IncidentRow[] = [];
  try {
    const { data: incidentData } = await supabase
      .from('incident_reports')
      .select(
        'id, description, action_taken, media_urls, incident_time, created_at, acknowledged_by_parent'
      )
      .eq('student_id', selected.id)
      .order('created_at', { ascending: false })
      .limit(30);

    incidents = ((incidentData ?? []) as IncidentRow[]).filter(
      (incident) =>
        mytDayOf(incident.incident_time ?? incident.created_at) === day
    );
  } catch {
    incidents = [];
  }

  // 5. Garis masa kronologi.
  const entries: ActivityTimelineEntry[] = [];

  for (const log of logs) {
    const kind = CATEGORY_KIND[log.category];
    if (!kind) continue; // Langkau kategori legasi seperti kehadiran_suhu.

    const content = log.content ?? {};
    entries.push({
      id: `log-${log.id}`,
      kind,
      title: CATEGORY_TITLE[log.category] ?? 'Log Harian',
      description:
        text(content.notes) ?? text(content.kesihatan) ?? text(content.tingkah_laku),
      time_label: formatTimeMy(log.created_at),
      at: log.created_at,
      details: buildDetails(log),
      media_urls: Array.isArray(log.media_urls) ? log.media_urls : [],
    });
  }

  if (attendance) {
    const details: { label: string; value: string }[] = [];
    if (attendance.suhu_tiba) {
      details.push({ label: 'Suhu Tiba', value: `${attendance.suhu_tiba} °C` });
    }
    if (attendance.suhu_balik) {
      details.push({
        label: 'Suhu Pulang',
        value: `${attendance.suhu_balik} °C`,
      });
    }
    if (attendance.catatan) {
      details.push({ label: 'Catatan', value: attendance.catatan });
    }

    entries.push({
      id: `attendance-${attendance.id}`,
      kind: 'attendance',
      title: `Kehadiran: ${attendance.status ?? 'Hadir'}`,
      description: null,
      time_label: formatTimeMy(attendance.created_at),
      at: attendance.created_at,
      details,
      media_urls: [],
    });
  }

  for (const incident of incidents) {
    entries.push({
      id: `incident-${incident.id}`,
      kind: 'incident',
      title: 'Laporan Insiden',
      description: incident.description,
      time_label: formatTimeMy(
        incident.incident_time ?? incident.created_at
      ),
      at: incident.incident_time ?? incident.created_at,
      details: incident.action_taken
        ? [{ label: 'Tindakan Diambil', value: incident.action_taken }]
        : [],
      media_urls: Array.isArray(incident.media_urls)
        ? incident.media_urls
        : [],
    });
  }

  entries.sort((a, b) => a.at.localeCompare(b.at));

  // 6. Nilaian pantas untuk kad status.
  const latestLogOf = (category: string): LogRow | null => {
    for (let index = logs.length - 1; index >= 0; index -= 1) {
      if (logs[index].category === category) return logs[index];
    }
    return null;
  };

  const mealLog = latestLogOf('makanan');
  const sleepLog = latestLogOf('tidur');
  const healthLog = latestLogOf('kesihatan_ubat');

  const moodValue = text(healthLog?.content?.tingkah_laku)?.split('\n')[0] ?? null;
  const mealValue = text(mealLog?.content?.appetite);
  const napDuration = text(sleepLog?.content?.duration);
  const napQuality = text(sleepLog?.content?.quality);

  const age = calculateAge(selected.dob);
  const ageGroupLabel =
    className ?? (age !== null ? `${age} tahun` : 'Kumpulan umur belum ditetapkan');

  const statusCards: {
    label: string;
    value: string;
    hint: string | null;
    icon: LucideIcon;
    tone: string;
  }[] = [
    {
      label: 'Kehadiran',
      value: attendance?.status ?? 'Tiada rekod',
      hint: attendance
        ? `Daftar masuk ${formatTimeMy(attendance.created_at)}`
        : 'Belum didaftarkan hari ini',
      icon: Clock,
      tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      label: 'Emosi Utama',
      value: moodValue ?? 'Tiada rekod',
      hint: moodValue ? 'Berdasarkan catatan kesihatan' : 'Belum dicatat oleh pendidik',
      icon: Smile,
      tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    },
    {
      label: 'Status Pemakanan',
      value: mealValue ?? 'Tiada rekod',
      hint: mealLog ? `Dicatat ${formatTimeMy(mealLog.created_at)}` : 'Belum dicatat oleh pendidik',
      icon: UtensilsCrossed,
      tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      label: 'Masa Tidur',
      value: napDuration ? `${napDuration} jam` : 'Tiada rekod',
      hint: napQuality,
      icon: Moon,
      tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
  ];

  const isToday = day === todayIso;

  return (
    <div className="space-y-5">
      {/* Pengepala: anak, kumpulan umur, cawangan PAPN, pemilih tarikh */}
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Aktiviti Hari Ini
            </p>
            <h1 className="mt-1 truncate text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              {selected.full_name}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {ageGroupLabel} · {branchName}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {formatDayLabel(day)}, {formatDateMy(day)}
              {isToday ? ' (Hari Ini)' : ''}
            </p>
          </div>
          <ActivityFilter
            childOptions={children.map((child) => ({
              id: child.id,
              full_name: child.full_name,
            }))}
            selectedStudentId={selected.id}
            selectedDate={day}
            todayIso={todayIso}
          />
        </div>
      </header>

      {/* Notis insiden */}
      {incidents.length > 0 ? (
        <section
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/60"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-red-800 dark:text-red-200">
                Insiden Dilaporkan Hari Ini
              </h2>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                Sila hubungi pendidik anak anda untuk maklumat lanjut.
              </p>
              <ul className="mt-3 space-y-2">
                {incidents.map((incident) => (
                  <li
                    key={incident.id}
                    className="rounded-lg bg-white/70 p-3 text-sm text-red-900 dark:bg-red-900/40 dark:text-red-100"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                      {formatTimeMy(incident.incident_time ?? incident.created_at)}
                      {incident.acknowledged_by_parent
                        ? ' · Telah Diakui'
                        : ' · Belum Diakui'}
                    </p>
                    <p className="mt-1 whitespace-pre-line">
                      {incident.description ?? 'Butiran insiden tidak dinyatakan.'}
                    </p>
                    {incident.action_taken ? (
                      <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                        Tindakan: {incident.action_taken}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {/* Grid status pantas */}
      <section aria-label="Status pantas hari ini">
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Status Pantas
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statusCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.tone}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {card.label}
                  </p>
                </div>
                <p className="mt-3 break-words text-lg font-bold text-slate-900 dark:text-slate-100">
                  {card.value}
                </p>
                {card.hint ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {card.hint}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Garis masa aktiviti */}
      <section aria-label="Garis masa aktiviti">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Garis Masa Aktiviti
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {entries.length} rekod
          </span>
        </div>
        {entries.length > 0 ? (
          <ActivityTimeline entries={entries} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Tiada aktiviti direkodkan untuk tarikh ini.
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Rekod akan muncul sebaik sahaja pendidik mengemas kini log harian.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
