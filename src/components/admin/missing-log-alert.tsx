import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatDayName } from '@/lib/week-window';
import type { MissingLogEntry } from '@/lib/types';
import {
  ManualAssessmentTrigger,
  type ManualAssessmentTriggerProps,
} from '@/components/admin/manual-assessment-trigger';

interface Props extends ManualAssessmentTriggerProps {
  entries: MissingLogEntry[];
}

const MAX_VISIBLE = 8;

export function MissingLogAlert({ entries, ...triggerProps }: Props) {
  const hasMissing = entries.length > 0;
  const visible = entries.slice(0, MAX_VISIBLE);
  const remaining = entries.length - visible.length;

  return (
    <section
      className={`card p-5 ${
        hasMissing ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span
            className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              hasMissing ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}
            aria-hidden
          >
            {hasMissing ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {hasMissing ? 'Amaran Log Tidak Lengkap' : 'Log Mingguan Lengkap'}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {hasMissing
                ? `${entries.length} murid belum melengkapkan log bagi ${triggerProps.weekLabel}. Semak sebelum cron pentaksiran berjalan pada Jumaat 18:00 (MYT).`
                : `Semua murid telah melengkapkan log bagi ${triggerProps.weekLabel}.`}
            </p>
          </div>
        </div>

        <ManualAssessmentTrigger {...triggerProps} defaultSelectedIds={entries.map((e) => e.student_id)} />
      </div>

      {hasMissing ? (
        <>
          <ul className="mt-4 divide-y divide-amber-200/70 rounded-xl border border-amber-200 bg-white/70">
            {visible.map((entry) => (
              <li
                key={entry.student_id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{entry.full_name}</p>
                  <p className="text-xs text-slate-600">{entry.class_name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-600">
                    Tiada log:{' '}
                    {entry.missing_dates.map((date) => formatDayName(date)).join(', ')}
                  </span>
                  <span className="badge-red">
                    {entry.submitted_days}/{entry.total_days}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {remaining > 0 ? (
            <p className="mt-2 text-xs text-slate-600">dan {remaining} murid lagi.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
