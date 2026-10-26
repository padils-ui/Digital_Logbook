import { formatDateTimeMy } from '@/lib/week-window';
import type { AssessmentAction, AssessmentAuditRow, CronRunRow } from '@/lib/types';

interface Props {
  rows: AssessmentAuditRow[];
  cronRuns: CronRunRow[];
  /** Nama pengguna bagi `actor_user_id`. */
  actorNames: Record<string, string>;
  /** Nama murid bagi `student_id`. */
  studentNames: Record<string, string>;
}

const CHIP_BASE =
  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold';

const ACTION_LABEL: Record<AssessmentAction, string> = {
  CREATED: 'Dicipta',
  UPDATED: 'Dikemas Kini',
  PUBLISHED: 'Diterbitkan',
  UNPUBLISHED: 'Ditarik Balik',
};

const ACTION_CLASS: Record<AssessmentAction, string> = {
  CREATED: `${CHIP_BASE} bg-sky-100 text-sky-800`,
  UPDATED: `${CHIP_BASE} bg-slate-100 text-slate-600`,
  PUBLISHED: 'badge-emerald',
  UNPUBLISHED: `${CHIP_BASE} bg-amber-100 text-amber-800`,
};

const FIELD_LABEL: Record<string, string> = {
  domain_scores: 'Skor domain',
  summary: 'Ringkasan',
  teacher_notes: 'Nota guru',
  suggestions_next_week: 'Cadangan',
  red_flags: 'Bendera merah',
  pdf_drive_file_id: 'Fail PDF',
  pdf_drive_url: 'Pautan PDF',
};

const CRON_STATUS_LABEL: Record<CronRunRow['status'], string> = {
  PENDING: 'Sedang Berjalan',
  SUCCESS: 'Berjaya',
  FAILED: 'Gagal',
};

const CRON_STATUS_CLASS: Record<CronRunRow['status'], string> = {
  PENDING: `${CHIP_BASE} bg-amber-100 text-amber-800`,
  SUCCESS: 'badge-emerald',
  FAILED: 'badge-red',
};

/** Pil status laporan (`DRAFT` / `PUBLISHED`). */
function StatusPill({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const published = status === 'PUBLISHED';
  return (
    <span className={published ? 'badge-emerald' : `${CHIP_BASE} bg-amber-100 text-amber-800`}>
      {published ? 'Diterbitkan' : 'Draf'}
    </span>
  );
}

/** Nama pelaku: pengguna sebenar atau enjin AI. */
function actorLabel(
  row: AssessmentAuditRow,
  actorNames: Record<string, string>
): string {
  if (row.actor_role === 'system') return 'Sistem (AI)';
  if (row.actor_user_id) return actorNames[row.actor_user_id] ?? 'Pengguna';
  return 'Sistem';
}

export function AssessmentAuditTrail({ rows, cronRuns, actorNames, studentNames }: Props) {
  return (
    <div className="space-y-6">
      <section className="card p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">Jejak Audit Pentaksiran</h2>
          <p className="mt-1 text-sm text-slate-600">
            Rekod automatik setiap perubahan laporan: penciptaan, suntingan guru dan
            peralihan draf ke terbit.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Belum ada jejak audit. Rekod akan muncul apabila laporan pentaksiran dicipta
            atau dikemas kini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Jejak audit laporan pentaksiran bagi pusat ini, disusun daripada yang terbaharu.
              </caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Masa
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Murid
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Tindakan
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Medan Berubah
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Pelaku
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const scoreEdited =
                    row.changed_fields.includes('domain_scores') &&
                    row.actor_role !== 'system';
                  return (
                    <tr key={row.id} className="align-top hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {formatDateTimeMy(row.created_at)}
                      </td>
                      <th scope="row" className="px-4 py-3 text-left">
                        <span className="block text-sm font-medium text-slate-900">
                          {studentNames[row.student_id] ?? 'Murid tidak diketahui'}
                        </span>
                        <span className="block text-xs font-normal text-slate-500">
                          Minggu {row.week_number ?? '—'} · {row.year ?? '—'}
                        </span>
                      </th>
                      <td className="px-4 py-3">
                        <span className={ACTION_CLASS[row.action]}>{ACTION_LABEL[row.action]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusPill status={row.from_status} />
                          <span className="text-xs text-slate-400" aria-hidden>
                            →
                          </span>
                          <StatusPill status={row.to_status} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.changed_fields.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {row.changed_fields.map((field) => (
                              <span
                                key={field}
                                className={
                                  field === 'domain_scores'
                                    ? `${CHIP_BASE} bg-amber-100 text-amber-800`
                                    : `${CHIP_BASE} bg-slate-100 text-slate-600`
                                }
                              >
                                {FIELD_LABEL[field] ?? field}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-sm text-slate-800">
                          {actorLabel(row, actorNames)}
                        </span>
                        {scoreEdited ? (
                          <span className="mt-0.5 block text-xs font-medium text-amber-700">
                            Pindaan skor manual
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">Sejarah Pelaksanaan Cron</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sepuluh pelaksanaan terakhir saluran paip pentaksiran, termasuk pencetus manual.
          </p>
        </div>

        {cronRuns.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Tiada rekod pelaksanaan bagi pusat ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Sejarah pelaksanaan cron pentaksiran mingguan bagi pusat ini.
              </caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Masa
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold">
                    Berjaya
                  </th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold">
                    Gagal
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Ralat
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cronRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {formatDateTimeMy(run.executed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={CRON_STATUS_CLASS[run.status]}>
                        {CRON_STATUS_LABEL[run.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-800">
                      {run.processed_students}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-800">
                      {run.failed_students}
                    </td>
                    <td className="px-4 py-3">
                      {run.error_message ? (
                        <span
                          className="block max-w-xs truncate text-xs text-red-700"
                          title={run.error_message}
                        >
                          {run.error_message}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
