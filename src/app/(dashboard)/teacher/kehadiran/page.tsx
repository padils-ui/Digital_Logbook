import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AttendanceAnalyticsCharts } from '@/components/attendance/attendance-analytics-charts';
import { AttendanceManager } from '@/components/teacher/attendance-manager';
import { getPresetRange } from '@/lib/attendance-range';
import {
  getAttendanceAnalytics,
  getTenantClasses,
} from '@/app/(dashboard)/teacher/kehadiran/actions';
import type { Student } from '@/lib/types';

export const metadata: Metadata = { title: 'Kehadiran Anak' };

interface AttendanceQueryRow {
  student_id: string;
  status: string | null;
  suhu_tiba: string | null;
  suhu_balik: string | null;
  catatan: string | null;
}

type KehadiranTab = 'log' | 'analytics';

const TAB_OPTIONS: { value: KehadiranTab; label: string }[] = [
  { value: 'log', label: 'Log Kehadiran' },
  { value: 'analytics', label: 'Analitis & Graf' },
];

/** Sahkan format tarikh ISO (YYYY-MM-DD). */
function normalizeDateParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) return raw;
  }
  return new Date().toISOString().slice(0, 10);
}

/** Sahkan tab aktif; lalai kepada log kehadiran. */
function normalizeTabParam(value: string | string[] | undefined): KehadiranTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'analytics' ? 'analytics' : 'log';
}

/** Bina pautan tab sambil mengekalkan parameter tarikh. */
function buildTabHref(tab: KehadiranTab, date: string): string {
  const params = new URLSearchParams({ date, tab });
  return `/teacher/kehadiran?${params.toString()}`;
}

export default async function KehadiranPage({
  searchParams,
}: {
  searchParams?: {
    date?: string | string[];
    tab?: string | string[];
  };
}) {
  const profile = await getCurrentUser();
  const tenantId = profile?.tenant_id ?? '';
  const date = normalizeDateParam(searchParams?.date);
  const activeTab = normalizeTabParam(searchParams?.tab);

  // Julat lalai "Minggu Ini" — sama seperti preset awal komponen carta.
  const initialRange = getPresetRange('week');

  // Klien admin (service role) untuk bacaan selamat — memintas rekursi RLS
  // pada jadual `users`. Setiap pertanyaan ditapis mengikut tenant_id.
  const admin = createAdminClient();

  const [studentsRes, attendanceRes, classes, analytics] = await Promise.all([
    admin.from('students').select('*').eq('tenant_id', tenantId).order('full_name'),
    admin
      .from('attendance')
      .select('student_id, status, suhu_tiba, suhu_balik, catatan')
      .eq('tenant_id', tenantId)
      .eq('date', date),
    getTenantClasses(),
    getAttendanceAnalytics({
      classId: null,
      startDate: initialRange.startDate,
      endDate: initialRange.endDate,
    }),
  ]);

  const students = (studentsRes.data ?? []) as Student[];

  const classNames: Record<string, string> = {};
  classes.forEach((c) => {
    classNames[c.id] = c.class_name;
  });

  const initialRecords: Record<
    string,
    {
      status: string | null;
      suhu_tiba: string | null;
      suhu_balik: string | null;
      catatan: string | null;
    }
  > = {};
  (attendanceRes.data ?? []).forEach((row) => {
    const r = row as AttendanceQueryRow;
    initialRecords[r.student_id] = {
      status: r.status,
      suhu_tiba: r.suhu_tiba,
      suhu_balik: r.suhu_balik,
      catatan: r.catatan,
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Kehadiran &amp; Suhu Anak
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Rekod kehadiran harian, suhu tiba dan suhu pulang bagi setiap anak.
        </p>
      </header>

      {/* ── Penukar tab (keadaan disimpan dalam URL) ─────────────── */}
      <nav
        className="inline-flex w-full gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto"
        aria-label="Paparan kehadiran"
      >
        {TAB_OPTIONS.map((option) => {
          const active = option.value === activeTab;
          return (
            <Link
              key={option.value}
              href={buildTabHref(option.value, date)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex min-h-touch flex-1 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:flex-none ${
                active
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      {activeTab === 'analytics' ? (
        <AttendanceAnalyticsCharts
          classes={classes}
          initialSummary={analytics.summary}
          initialDaily={analytics.daily}
          initialClassId={null}
          initialPreset="week"
        />
      ) : (
        <AttendanceManager
          key={date}
          students={students}
          classNames={classNames}
          date={date}
          initialRecords={initialRecords}
        />
      )}
    </div>
  );
}
