import { CheckCircle2, UserCog, XCircle } from 'lucide-react';
import type { TeacherLogStatusRow } from '@/lib/types';

interface TeacherLogStatusTableProps {
  /** Status kemaskini log bagi setiap pendidik. */
  rows: TeacherLogStatusRow[];
}

/**
 * Jadual ringkas "Status Kemaskini Pendidik".
 *
 * Menunjukkan nama pendidik, kelas yang dipertanggungjawabkan dan sama ada
 * log harian telah dikemas kini pada hari ini.
 */
export function TeacherLogStatusTable({ rows }: TeacherLogStatusTableProps) {
  const lengkap = rows.filter((row) => row.lengkap).length;

  return (
    <section className="card p-5" aria-labelledby="teacher-log-status-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <UserCog className="h-4 w-4" aria-hidden />
          </span>
          <h2
            id="teacher-log-status-title"
            className="text-sm font-semibold text-slate-800"
          >
            Status Kemaskini Pendidik
          </h2>
        </div>
        <span className="badge-slate">
          {lengkap}/{rows.length} lengkap
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Tiada pendidik berdaftar untuk pusat anda.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto touch-pan-x">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Pendidik
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Kelas
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Log Harian
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.teacher_id} className="text-slate-700">
                  <td className="py-2 pr-3 font-medium text-slate-800">
                    {row.teacher_name}
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">
                    {row.class_names}
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        row.lengkap
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {row.lengkap ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                      ) : (
                        <XCircle className="h-3 w-3" aria-hidden />
                      )}
                      {row.lengkap ? 'Lengkap' : 'Belum Lengkap'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
