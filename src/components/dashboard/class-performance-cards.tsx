import { BookOpenText, CheckCircle2, Clock, UserX, Users } from 'lucide-react';
import type { ClassAttendanceSummary } from '@/lib/types';

interface ClassPerformanceCardsProps {
  /** Ringkasan kehadiran bagi setiap kelas berdaftar. */
  summaries: ClassAttendanceSummary[];
  /** Label tarikh rujukan (contoh: `30 Okt 2026`). */
  dateLabel: string;
}

/**
 * Senarai kad "Kehadiran Mengikut Kelas".
 *
 * Setiap kad memaparkan peratus kehadiran, kiraan status kehadiran dan
 * status penyiapan log harian bagi kelas tersebut.
 */
export function ClassPerformanceCards({
  summaries,
  dateLabel,
}: ClassPerformanceCardsProps) {
  return (
    <section className="card p-5" aria-labelledby="class-performance-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <BookOpenText className="h-4 w-4" aria-hidden />
          </span>
          <h2
            id="class-performance-title"
            className="text-sm font-semibold text-slate-800"
          >
            Kehadiran Mengikut Kelas
          </h2>
        </div>
        <span className="text-xs text-slate-500">{dateLabel}</span>
      </div>

      {summaries.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Tiada kelas berdaftar untuk pusat anda.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {summaries.map((summary) => (
            <article
              key={summary.class_id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-800">
                    {summary.class_name}
                  </h3>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                    <Users className="h-3 w-3" aria-hidden />
                    {summary.total_students} anak berdaftar
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    summary.log_lengkap
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {summary.log_lengkap ? 'Log lengkap' : 'Log belum lengkap'}
                </span>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Peratus kehadiran</span>
                  <span className="font-semibold text-slate-900">
                    {summary.peratus}%
                  </span>
                </div>
                <div
                  className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-valuenow={summary.peratus}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Peratus kehadiran ${summary.class_name}`}
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${summary.peratus}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  Hadir {summary.hadir}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  <Clock className="h-3 w-3" aria-hidden />
                  Lewat {summary.lewat}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  <UserX className="h-3 w-3" aria-hidden />
                  Tidak Hadir {summary.tidak_hadir}
                </span>
              </div>

              <p className="mt-2 text-[11px] text-slate-500">
                {summary.logs_today} daripada {summary.total_students} log harian
                diterima
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
