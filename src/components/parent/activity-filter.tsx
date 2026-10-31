'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';

interface ChildOption {
  id: string;
  full_name: string;
}

interface ActivityFilterProps {
  childOptions: ChildOption[];
  selectedStudentId: string;
  selectedDate: string;
  /** Tarikh hari ini (ISO `YYYY-MM-DD`) mengikut waktu Malaysia. */
  todayIso: string;
}

/** Pemilih anak + tarikh untuk paparan aktiviti harian ibu bapa. */
export function ActivityFilter({
  childOptions,
  selectedStudentId,
  selectedDate,
  todayIso,
}: ActivityFilterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState(selectedStudentId);
  const [date, setDate] = useState(selectedDate);

  const navigate = (nextStudentId: string, nextDate: string) => {
    const params = new URLSearchParams({ student: nextStudentId, date: nextDate });
    startTransition(() => router.push(`/parent/today?${params.toString()}`));
  };

  const handleStudentChange = (value: string) => {
    setStudentId(value);
    navigate(value, date);
  };

  const handleDateChange = (value: string) => {
    if (!value) return;
    setDate(value);
    navigate(studentId, value);
  };

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
      {childOptions.length > 1 && (
        <div className="w-full sm:w-52">
          <label htmlFor="activity-child" className="label">
            Pilih Anak
          </label>
          <select
            id="activity-child"
            className="input"
            value={studentId}
            onChange={(event) => handleStudentChange(event.target.value)}
          >
            {childOptions.map((child) => (
              <option key={child.id} value={child.id}>
                {child.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="w-full sm:w-44">
        <label htmlFor="activity-date" className="label">
          Tarikh Aktiviti
        </label>
        <input
          id="activity-date"
          type="date"
          className="input"
          value={date}
          max={todayIso}
          onChange={(event) => handleDateChange(event.target.value)}
        />
      </div>

      <Link
        href={`/parent/today?student=${studentId}&date=${todayIso}`}
        className="btn-ghost w-full sm:w-auto"
      >
        <CalendarDays className="h-4 w-4" aria-hidden />
        Hari Ini
      </Link>

      {isPending && (
        <span className="flex items-center justify-center pb-3 text-xs font-medium text-slate-500 dark:text-slate-400 sm:pb-3">
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
          Memuatkan…
        </span>
      )}
    </div>
  );
}
