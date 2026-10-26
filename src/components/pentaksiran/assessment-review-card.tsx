'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Send,
  Sparkles,
} from 'lucide-react';
import { PermataRadarChart } from '@/components/pentaksiran/radar-chart';
import { publishAssessmentReport } from '@/app/(dashboard)/teacher/pentaksiran/actions';
import type { PermataDomain, RedFlag } from '@/lib/validations/assessment';

/** Laporan draf yang dipaparkan untuk semakan guru. */
export interface ReviewReport {
  id: string;
  studentName: string;
  className: string;
  weekNumber: number;
  year: number;
  /** Tempoh minggu yang telah diformat (contoh: 06 Okt 2026 – 10 Okt 2026). */
  periodLabel: string;
  domainScores: Partial<Record<PermataDomain, number | null>>;
  summary: string;
  teacherNotes: string;
  suggestionsNextWeek: string[];
  redFlags: RedFlag[];
}

interface AssessmentReviewCardProps {
  report: ReviewReport;
}

const SEVERITY_LABEL: Record<RedFlag['severity'], string> = {
  HIGH: 'Tinggi',
  MEDIUM: 'Sederhana',
  LOW: 'Rendah',
};

const SEVERITY_CLASS: Record<RedFlag['severity'], string> = {
  HIGH: 'badge-red',
  MEDIUM:
    'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700',
  LOW: 'badge-slate',
};

/** Purata skor bagi domain yang mempunyai data sah. */
function averageScore(
  scores: Partial<Record<PermataDomain, number | null>>
): number | null {
  const values = Object.values(scores).filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );
  if (values.length === 0) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

/** Kad semakan: carta radar, bendera merah, ringkasan dan catatan guru. */
export function AssessmentReviewCard({ report }: AssessmentReviewCardProps) {
  const router = useRouter();
  const [summary, setSummary] = useState(report.summary);
  const [teacherNotes, setTeacherNotes] = useState(report.teacherNotes);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<
    { type: 'success' | 'error'; text: string } | null
  >(null);
  const [, startTransition] = useTransition();

  const average = averageScore(report.domainScores);

  async function handlePublish() {
    setSaving(true);
    setMessage(null);

    const result = await publishAssessmentReport({
      reportId: report.id,
      summary,
      teacherNotes,
    });

    setSaving(false);

    if (!result.ok) {
      setMessage({
        type: 'error',
        text: result.error ?? 'Ralat tidak diketahui.',
      });
      return;
    }

    setPdfUrl(result.pdfUrl ?? null);
    setMessage({
      type: 'success',
      text: 'Laporan diterbitkan dan disegerakkan ke Google Drive.',
    });
    startTransition(() => router.refresh());
  }

  return (
    <article className="card space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {report.studentName}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {report.className} · Minggu {report.weekNumber} ({report.year})
          </p>
          <p className="text-xs text-slate-500">{report.periodLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="badge-slate">Draf</span>
          <span className="text-xs font-semibold text-slate-700">
            {average === null ? 'Purata: —' : `Purata: ${average}`}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2">
          <PermataRadarChart scores={report.domainScores} height={220} />
        </div>

        <div className="space-y-3">
          <div>
            <p className="label">Bendera Merah</p>
            {report.redFlags.length === 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Tiada kebimbangan dikesan.
              </p>
            ) : (
              <ul className="space-y-2">
                {report.redFlags.map((flag, index) => (
                  <li
                    key={`${flag.flag}-${index}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                  >
                    <span className={SEVERITY_CLASS[flag.severity]}>
                      {SEVERITY_LABEL[flag.severity]}
                    </span>
                    <p className="mt-1 text-xs font-medium text-slate-800">
                      {flag.flag}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Cadangan: {flag.recommendation}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {report.suggestionsNextWeek.length > 0 && (
            <div>
              <p className="label">Cadangan Minggu Hadapan</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                {report.suggestionsNextWeek.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="label" htmlFor={`summary-${report.id}`}>
            Ringkasan Perkembangan
          </label>
          <textarea
            id={`summary-${report.id}`}
            className="input resize-y"
            rows={5}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor={`notes-${report.id}`}>
            Catatan Guru
          </label>
          <textarea
            id={`notes-${report.id}`}
            className="input resize-y"
            rows={3}
            placeholder="Catatan tambahan sebelum laporan dihantar kepada ibu bapa…"
            value={teacherNotes}
            onChange={(event) => setTeacherNotes(event.target.value)}
          />
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={
          message
            ? message.type === 'success'
              ? 'flex items-center gap-1.5 text-xs font-medium text-emerald-700'
              : 'text-xs font-medium text-red-600'
            : 'sr-only'
        }
      >
        {message ? (
          <>
            {message.type === 'success' && (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {message.text}
          </>
        ) : (
          ''
        )}
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Lihat PDF
          </a>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={handlePublish}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          {saving ? 'Menyegerak…' : 'Sahkan & Hantar'}
        </button>
      </div>
    </article>
  );
}

export default AssessmentReviewCard;
