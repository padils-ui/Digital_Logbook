import { CalendarDays } from 'lucide-react';
import type { AcademicCalendarRow } from '@/lib/types';
import { formatDateShort, formatDayName } from '@/lib/week-window';

interface UpcomingEventsCardProps {
  /** Catatan takwim daripada tarikh hari ini ke hadapan (sudah diisih). */
  entries: AcademicCalendarRow[];
  /** Bilangan maksimum catatan yang dipaparkan. */
  limit?: number;
}

/**
 * Kad ringkasan "Acara & Cuti Akan Datang" pada Papan Pemuka.
 *
 * Senarai ini membaca jadual `academic_calendar` dan hanya memaparkan
 * catatan daripada tarikh hari ini ke hadapan.
 */
export function UpcomingEventsCard({ entries, limit = 5 }: UpcomingEventsCardProps) {
  const visible = entries.slice(0, limit);

  return (
    <section className="card p-5" aria-labelledby="upcoming-events-title">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
          <CalendarDays className="h-4 w-4" aria-hidden />
        </span>
        <h2 id="upcoming-events-title" className="text-sm font-semibold text-slate-800">
          Acara &amp; Cuti Akan Datang
        </h2>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Tiada acara atau cuti dijadualkan.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {visible.map((entry) => (
            <li key={entry.id} className="flex min-h-touch items-center gap-3 py-2">
              <span
                className={`inline-flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-semibold uppercase leading-tight ${
                  entry.is_holiday
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-sky-100 text-sky-800'
                }`}
                aria-hidden
              >
                {formatDateShort(entry.date)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">
                  {entry.event_name}
                </span>
                <span className="block text-xs text-slate-500">
                  {formatDayName(entry.date)}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  entry.is_holiday
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-sky-100 text-sky-800'
                }`}
              >
                {entry.is_holiday ? 'Cuti' : 'Acara'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {entries.length > visible.length ? (
        <p className="mt-3 text-xs text-slate-500">
          {entries.length - visible.length} lagi catatan akan datang.
        </p>
      ) : null}
    </section>
  );
}
