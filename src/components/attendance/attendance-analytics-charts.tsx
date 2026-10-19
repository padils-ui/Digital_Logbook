'use client';

import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Clock,
  Inbox,
  Loader2,
  Percent,
  Thermometer,
  UserX,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getAttendanceAnalytics } from '@/app/(dashboard)/teacher/kehadiran/actions';
import {
  getPresetRange,
  type AttendanceDateRange,
  type AttendanceRangePreset,
} from '@/lib/attendance-range';
import type { ClassRow } from '@/lib/types';
import type {
  AttendanceDailyChartPoint,
  AttendanceSummaryStats,
} from '@/types/attendance';

interface AttendanceAnalyticsChartsProps {
  /** Senarai kelas milik tenant semasa (untuk penapis). */
  classes: Pick<ClassRow, 'id' | 'class_name'>[];
  /** Ringkasan awal yang dimuatkan oleh komponen pelayan. */
  initialSummary: AttendanceSummaryStats;
  /** Siri harian awal yang dimuatkan oleh komponen pelayan. */
  initialDaily: AttendanceDailyChartPoint[];
  /** Penapis kelas awal (null = semua kelas). */
  initialClassId?: string | null;
  /** Julat tarikh awal; mesti sepadan dengan data awal. */
  initialPreset?: AttendanceRangePreset;
}

const RANGE_OPTIONS: { value: AttendanceRangePreset; label: string }[] = [
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'last30', label: '30 Hari Lepas' },
];

/** Singkatan bulan Bahasa Melayu untuk paparan julat tarikh. */
const MALAY_MONTHS_SHORT = [
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

/** Warna siri carta kehadiran. */
const COLOR_HADIR = '#10b981';
const COLOR_LEWAT = '#f59e0b';
const COLOR_TIDAK_HADIR = '#f43f5e';
const COLOR_SUHU_TIBA = '#3b82f6';
const COLOR_SUHU_BALIK = '#a855f7';
const COLOR_AMALAN_DEMAM = '#ef4444';

/** Papar tarikh ISO sebagai contoh '19 Okt 2026'. */
function formatDisplayDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return `${parsed.getDate()} ${
    MALAY_MONTHS_SHORT[parsed.getMonth()] ?? ''
  } ${parsed.getFullYear()}`;
}

/** Ringkaskan label paksi, contoh 'Isnin (19 Oct)' → '19 Oct'. */
function shortLabel(label: string): string {
  const match = label.match(/\(([^)]+)\)/);
  return match ? match[1] : label;
}

/** Kad metrik ringkasan. */
function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  warning = false,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone: string;
  warning?: boolean;
  badge?: ReactNode;
}) {
  return (
    <div
      className={`card flex items-start gap-3 ${
        warning ? 'border-red-200 bg-red-50/40' : ''
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold leading-tight text-slate-900">
          {value}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
          {badge}
        </div>
      </div>
    </div>
  );
}

/** Keadaan kosong apabila tiada data bagi julat dipilih. */
function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
      <Inbox className="h-8 w-8 text-slate-400" aria-hidden />
      <p className="text-sm font-medium text-slate-600">{message}</p>
      <p className="text-xs text-slate-500">
        Cuba tukar julat tarikh atau penapis kelas.
      </p>
    </div>
  );
}

/**
 * Papan pemuka analitik kehadiran & suhu.
 *
 * Data awal datang daripada komponen pelayan; perubahan penapis memanggil
 * semula server action `getAttendanceAnalytics` yang mengekalkan pengasingan
 * tenant di sisi pelayan.
 */
export function AttendanceAnalyticsCharts({
  classes,
  initialSummary,
  initialDaily,
  initialClassId = null,
  initialPreset = 'week',
}: AttendanceAnalyticsChartsProps) {
  const [summary, setSummary] = useState<AttendanceSummaryStats>(initialSummary);
  const [daily, setDaily] = useState<AttendanceDailyChartPoint[]>(initialDaily);
  const [preset, setPreset] = useState<AttendanceRangePreset>(initialPreset);
  const [classId, setClassId] = useState<string>(initialClassId ?? 'all');
  const [range, setRange] = useState<AttendanceDateRange>(() =>
    getPresetRange(initialPreset)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyFilters(
    nextPreset: AttendanceRangePreset,
    nextClassId: string
  ) {
    const nextRange = getPresetRange(nextPreset);
    setLoading(true);
    setError(null);

    try {
      const result = await getAttendanceAnalytics({
        classId: nextClassId === 'all' ? null : nextClassId,
        startDate: nextRange.startDate,
        endDate: nextRange.endDate,
      });
      setSummary(result.summary);
      setDaily(result.daily);
      setRange(nextRange);
    } catch {
      setError('Gagal memuatkan data analitik. Sila cuba lagi.');
    } finally {
      setLoading(false);
    }
  }

  function handlePresetChange(nextPreset: AttendanceRangePreset) {
    if (loading || nextPreset === preset) return;
    setPreset(nextPreset);
    void applyFilters(nextPreset, classId);
  }

  function handleClassChange(nextClassId: string) {
    setClassId(nextClassId);
    void applyFilters(preset, nextClassId);
  }

  const totalRecords =
    summary.hadirCount + summary.tidakHadirCount + summary.lewatCount;
  const hasAttendanceData = daily.some(
    (point) => point.hadir + point.tidakHadir + point.lewat > 0
  );
  const hasTemperatureData = daily.some(
    (point) => point.avgSuhuTiba !== null || point.avgSuhuBalik !== null
  );

  return (
    <div className="space-y-4" aria-busy={loading}>
      {/* ── Kad statistik ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Jumlah Anak Berdaftar"
          value={String(summary.totalStudents)}
          hint="Dalam skop penapis semasa"
          icon={Users}
          tone="bg-brand-50 text-brand-600"
        />
        <StatCard
          label="Kadar Kehadiran"
          value={`${summary.attendanceRate}%`}
          hint={`${summary.hadirCount} hadir daripada ${totalRecords} rekod`}
          icon={Percent}
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Tidak Hadir & Lewat"
          value={String(summary.tidakHadirCount + summary.lewatCount)}
          hint={`${summary.tidakHadirCount} tidak hadir · ${summary.lewatCount} lewat`}
          icon={UserX}
          tone="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Amaran Suhu Tinggi"
          value={String(summary.feverCount)}
          hint="Suhu ≥ 37.5°C (tiba atau balik)"
          icon={Thermometer}
          tone="bg-red-50 text-red-600"
          warning={summary.feverCount > 0}
          badge={
            summary.feverCount > 0 ? (
              <span className="badge-red">
                <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
                Demam
              </span>
            ) : undefined
          }
        />
      </div>

      {/* ── Bar penapis ───────────────────────────────────────── */}
      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map((option) => {
            const active = option.value === preset;
            return (
              <button
                key={option.value}
                type="button"
                className={`chip ${
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : ''
                }`}
                aria-pressed={active}
                disabled={loading}
                onClick={() => handlePresetChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">
            {formatDisplayDate(range.startDate)} –{' '}
            {formatDisplayDate(range.endDate)}
          </span>
          <label className="sr-only" htmlFor="analytics-class-filter">
            Tapis mengikut kelas
          </label>
          <select
            id="analytics-class-filter"
            className="input sm:w-56"
            value={classId}
            disabled={loading}
            onChange={(event) => handleClassChange(event.target.value)}
          >
            <option value="all">Semua Kelas</option>
            {classes.map((kelas) => (
              <option key={kelas.id} value={kelas.id}>
                {kelas.class_name}
              </option>
            ))}
          </select>
          {loading ? (
            <Loader2
              className="h-4 w-4 animate-spin text-brand-600"
              aria-label="Memuatkan data"
            />
          ) : null}
        </div>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* ── Carta ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="card">
          <header className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Kehadiran Harian
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Bilangan anak mengikut status kehadiran.
            </p>
          </header>

          {hasAttendanceData ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={daily}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickFormatter={shortLabel}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickMargin={8}
                    minTickGap={16}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: '#e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="hadir"
                    name="Hadir"
                    stackId="kehadiran"
                    fill={COLOR_HADIR}
                  />
                  <Bar
                    dataKey="lewat"
                    name="Lewat"
                    stackId="kehadiran"
                    fill={COLOR_LEWAT}
                  />
                  <Bar
                    dataKey="tidakHadir"
                    name="Tidak Hadir"
                    stackId="kehadiran"
                    fill={COLOR_TIDAK_HADIR}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState message="Tiada rekod kehadiran bagi julat ini." />
          )}
        </section>

        <section className="card">
          <header className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Trend Suhu Badan Purata
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Purata suhu tiba dan pulang (°C) berbanding ambang demam.
            </p>
          </header>

          {hasTemperatureData ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={daily}
                  margin={{ top: 20, right: 16, left: -8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickFormatter={shortLabel}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickMargin={8}
                    minTickGap={16}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[35.5, 39]}
                    ticks={[35.5, 36.5, 37.5, 38.5, 39]}
                    tickFormatter={(value: number) => `${value}°`}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: '#e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine
                    y={37.5}
                    stroke={COLOR_AMALAN_DEMAM}
                    strokeDasharray="5 4"
                    label={{
                      value: 'Ambang Demam (37.5°C)',
                      position: 'insideTopRight',
                      fill: '#dc2626',
                      fontSize: 11,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgSuhuTiba"
                    name="Suhu Tiba"
                    stroke={COLOR_SUHU_TIBA}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                    unit="°C"
                  />
                  <Line
                    type="monotone"
                    dataKey="avgSuhuBalik"
                    name="Suhu Balik"
                    stroke={COLOR_SUHU_BALIK}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                    unit="°C"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState message="Tiada rekod suhu bagi julat ini." />
          )}
        </section>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Kadar kehadiran = (Hadir + Lewat) ÷ jumlah rekod × 100. Suhu dipaparkan
        dalam darjah Celsius.
      </p>
    </div>
  );
}
