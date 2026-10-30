'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AcademicCalendarRow } from '@/lib/types';

const MONTH_NAMES_MY = [
  'Januari',
  'Februari',
  'Mac',
  'April',
  'Mei',
  'Jun',
  'Julai',
  'Ogos',
  'September',
  'Oktober',
  'November',
  'Disember',
];

const WEEKDAY_SHORT_MY = ['Aha', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];

interface AcademicCalendarWidgetProps {
  entries: AcademicCalendarRow[];
  /** Tarikh hari ini ISO `YYYY-MM-DD` (waktu Malaysia). */
  today: string;
}

/** Bina senarai sel grid (null = tempat kosong sebelum/ selepas bulan). */
function buildCells(year: number, monthIndex: number): (string | null)[] {
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const isoMonth = String(monthIndex + 1).padStart(2, '0');
    const isoDay = String(day).padStart(2, '0');
    cells.push(`${year}-${isoMonth}-${isoDay}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Kalendar takwim akademik bulanan dengan sorotan cuti dan acara pusat. */
export function AcademicCalendarWidget({ entries, today }: AcademicCalendarWidgetProps) {
  const [view, setView] = useState(() => {
    const [yearText, monthText] = today.split('-');
    return { year: Number(yearText), month: Number(monthText) - 1 };
  });

  const entriesByDate = useMemo(() => {
    const map = new Map<string, AcademicCalendarRow[]>();
    entries.forEach((entry) => {
      const list = map.get(entry.date);
      if (list) list.push(entry);
      else map.set(entry.date, [entry]);
    });
    return map;
  }, [entries]);

  const cells = buildCells(view.year, view.month);

  function shiftMonth(delta: number) {
    setView((prev) => {
      const next = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  }

  function goToToday() {
    const [yearText, monthText] = today.split('-');
    setView({ year: Number(yearText), month: Number(monthText) - 1 });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Takwim Akademik</h2>
          <p className="mt-1 text-xs text-slate-500">
            Cuti, cuti peristiwa dan penutupan pusat.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="btn-ghost px-2"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <p
            className="min-w-[9rem] text-center text-sm font-semibold text-slate-800"
            aria-live="polite"
          >
            {MONTH_NAMES_MY[view.month]} {view.year}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="btn-ghost px-2"
            aria-label="Bulan seterusnya"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="btn bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            Hari Ini
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_SHORT_MY.map((label) => (
          <span
            key={label}
            className="py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {label}
          </span>
        ))}

        {cells.map((iso, index) => {
          if (!iso) {
            return <span key={`empty-${index}`} aria-hidden className="h-10" />;
          }

          const dayEntries = entriesByDate.get(iso) ?? [];
          const hasHoliday = dayEntries.some((entry) => entry.is_holiday);
          const hasEvent = dayEntries.some((entry) => !entry.is_holiday);
          const isToday = iso === today;
          const dayNumber = Number(iso.slice(8, 10));

          const label = dayEntries.length
            ? `${dayNumber} ${MONTH_NAMES_MY[view.month]} ${view.year}: ${dayEntries
                .map((entry) => entry.event_name)
                .join(', ')}`
            : `${dayNumber} ${MONTH_NAMES_MY[view.month]} ${view.year}`;

          let tone = 'text-slate-700 hover:bg-slate-100';
          if (hasHoliday) tone = 'bg-amber-100 font-semibold text-amber-900';
          else if (hasEvent) tone = 'bg-sky-100 font-semibold text-sky-900';

          return (
            <span
              key={iso}
              title={label}
              aria-label={label}
              className={`flex h-10 items-center justify-center rounded-lg text-sm transition-colors ${tone} ${
                isToday ? 'ring-2 ring-brand-600 ring-offset-1' : ''
              }`}
            >
              {dayNumber}
            </span>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-300" aria-hidden />
          Cuti / Penutupan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-sky-100 ring-1 ring-sky-300" aria-hidden />
          Acara Pusat
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded ring-2 ring-brand-600" aria-hidden />
          Hari Ini
        </span>
      </div>
    </div>
  );
}
