'use client';

/**
 * Butang muat turun Log Mingguan (PDF).
 *
 * Menghantar permintaan ke `/api/export/weekly-log`, kemudian menyimpan
 * respons binari sebagai fail melalui Object URL — pengguna menerima fail
 * serta-merta tanpa membuka tab baharu.
 */

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface StudentOption {
  id: string;
  name: string;
}

interface WeeklyLogDownloadProps {
  /** Anak yang boleh dipilih (ibu bapa). */
  students: StudentOption[];
  /** Isnin bagi minggu lalai (ISO `YYYY-MM-DD`). */
  defaultWeekStart: string;
}

/** Ambil nama fail daripada pengepala `Content-Disposition`. */
function parseFileName(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1]?.trim() || fallback;
}

export function WeeklyLogDownload({ students, defaultWeekStart }: WeeklyLogDownloadProps) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? '');
  const [weekStart, setWeekStart] = useState(defaultWeekStart);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Muat Turun Log Mingguan
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Tiada anak dipautkan ke akaun anda — log mingguan belum tersedia.
        </p>
      </div>
    );
  }

  async function handleDownload() {
    if (!studentId || loading) return;
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({ student_id: studentId, week_start: weekStart });
      const response = await fetch(`/api/export/weekly-log?${query.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        let message = 'Gagal menjana log mingguan. Sila cuba lagi.';
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) message = payload.error;
        } catch {
          // Respons bukan JSON — kekalkan mesej lalai.
        }
        setError(message);
        return;
      }

      const blob = await response.blob();
      const fileName = parseFileName(
        response.headers.get('Content-Disposition'),
        `Log_Mingguan_${weekStart}.pdf`
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Rangkaian tidak dapat dihubungi. Sila cuba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <Download className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Muat Turun Log Mingguan
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Jana dokumen PDF rasmi bagi Isnin hingga Jumaat minggu dipilih.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {students.length > 1 ? (
          <label className="block">
            <span className="label">Pilih Anak</span>
            <select
              className="input mt-1"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              disabled={loading}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className="label">Minggu Laporan</span>
          <input
            type="date"
            className="input mt-1"
            value={weekStart}
            onChange={(event) => setWeekStart(event.target.value)}
            disabled={loading}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="btn-primary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Menjana PDF…
          </>
        ) : (
          <>
            <Download className="h-4 w-4" aria-hidden />
            Muat Turun PDF
          </>
        )}
      </button>

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
