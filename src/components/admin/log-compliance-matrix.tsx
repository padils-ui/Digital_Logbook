import { Fragment } from 'react';
import { formatDateShort, formatDayLabel, formatDayName } from '@/lib/week-window';
import type { LogDayStatus, LogMatrixClassGroup } from '@/lib/types';

interface Props {
  groups: LogMatrixClassGroup[];
  /** Lima tarikh Isnin–Jumaat bagi minggu yang dipilih. */
  days: string[];
}

const STATUS_LABEL: Record<LogDayStatus, string> = {
  submitted: 'Ada',
  missing: 'Tiada',
  upcoming: 'Belum',
};

const STATUS_CLASS: Record<LogDayStatus, string> = {
  submitted: 'badge-emerald',
  missing: 'badge-red',
  upcoming: 'badge-slate',
};

export function LogComplianceMatrix({ groups, days }: Props) {
  const totalStudents = groups.reduce((sum, group) => sum + group.students.length, 0);
  const totalSubmitted = groups.reduce(
    (sum, group) => sum + group.students.reduce((s, row) => s + row.submitted_days, 0),
    0
  );
  const totalCells = totalStudents * days.length;
  const percent = totalCells === 0 ? 0 : Math.round((totalSubmitted / totalCells) * 100);

  return (
    <section className="card p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Matriks Kepatuhan Log Mingguan</h2>
          <p className="mt-1 text-sm text-slate-600">
            Status log harian bagi setiap murid dari Isnin hingga Jumaat.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">
            {totalSubmitted} / {totalCells} hari lengkap
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {percent}%
          </span>
        </div>
      </div>

      {totalStudents === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">
          Tiada murid berdaftar untuk pusat ini.
        </p>
      ) : (
        <div className="overflow-x-auto touch-pan-x">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <caption className="sr-only">
              Matriks kepatuhan log harian mengikut kelas dan murid bagi minggu yang dipilih.
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th
                  scope="col"
                  className="sticky left-0 z-20 bg-slate-50 px-4 py-3 font-semibold shadow-sm"
                >
                  Murid
                </th>
                {days.map((date) => (
                  <th
                    key={date}
                    scope="col"
                    className="px-3 py-3 text-center font-semibold"
                    title={formatDayLabel(date)}
                  >
                    <span className="block">{formatDayName(date)}</span>
                    <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-slate-400">
                      {formatDateShort(date)}
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-center font-semibold">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((group) => (
                <Fragment key={group.class_id ?? 'tanpa-kelas'}>
                  <tr>
                    <td
                      colSpan={days.length + 2}
                      className="sticky left-0 z-10 min-w-[180px] bg-slate-100 px-4 py-2"
                    >
                      <span className="text-sm font-semibold text-slate-800">
                        {group.class_name}
                      </span>
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        ({group.students.length} murid)
                      </span>
                    </td>
                  </tr>
                  {group.students.map((student) => (
                    <tr key={student.student_id} className="hover:bg-slate-50">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900 shadow-sm"
                      >
                        <span className="block">{student.full_name}</span>
                        {student.nickname ? (
                          <span className="block text-xs font-normal text-slate-500">
                            {student.nickname}
                          </span>
                        ) : null}
                      </th>
                      {days.map((date) => {
                        const status = student.days[date] ?? 'missing';
                        return (
                          <td key={date} className="px-3 py-3 text-center">
                            <span
                              className={STATUS_CLASS[status]}
                              title={`${student.full_name} — ${formatDayLabel(date)}: ${STATUS_LABEL[status]}`}
                            >
                              {STATUS_LABEL[status]}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={
                            student.submitted_days === days.length
                              ? 'badge-emerald'
                              : student.submitted_days === 0
                                ? 'badge-red'
                                : 'badge-slate'
                          }
                        >
                          {student.submitted_days}/{days.length}
                        </span>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 px-5 py-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden /> Log dihantar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden /> Log tiada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden /> Hari belum tiba
        </span>
      </div>
    </section>
  );
}
