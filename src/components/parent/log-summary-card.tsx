'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { GroupedDailyReport } from '@/lib/types';

interface LogSummaryCardProps {
  report: GroupedDailyReport;
}

// Convert Google Drive view/download URLs to direct embeddable thumbnail URLs
function formatImageUrl(url: string): string {
  if (!url) return '';

  const idMatch = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
  }

  return url;
}

export function LogSummaryCard({ report }: LogSummaryCardProps) {
  const router = useRouter();
  const supabase = createClient();

  const safeReport = report || {
    date: '',
    studentId: '',
    studentName: '',
    logIds: [],
    isReviewed: false,
    parentComment: null,
    entries: [],
  };

  const [comment, setComment] = useState(safeReport.parentComment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewed, setIsReviewed] = useState(safeReport.isReviewed);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Default unreviewed/pending reports to expanded, and already reviewed ones to collapsed
  const [isExpanded, setIsExpanded] = useState(!safeReport.isReviewed);

  const handleImageError = (mediaUrl: string) => {
    setFailedImages((prev) => ({ ...prev, [mediaUrl]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase
      .from('daily_logs')
      .update({
        parent_comment: comment,
        parent_reviewed: true,
        parent_commented_at: new Date().toISOString(),
      })
      .in('id', safeReport.logIds);

    setIsSubmitting(false);

    if (!error) {
      setIsReviewed(true);
      setIsExpanded(false); // Automatically collapse upon successful review submission
      router.refresh();
    } else {
      alert('Ralat semasa menghantar ulasan. Sila cuba lagi.');
    }
  };

  if (!report) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Clickable Header / Accordion Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-slate-50 focus:outline-none dark:hover:bg-slate-800/60"
      >
        <div className="flex items-center gap-3">
          {/* Chevron Icon */}
          <svg
            className={`h-5 w-5 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-800 dark:text-slate-100">{report.date}</span>
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                ({report.entries.length} catatan)
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{report.studentName}</p>
          </div>
        </div>

        <div>
          {isReviewed ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              Telah Disahkan
            </span>
          ) : (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              Ulasan Diperlukan
            </span>
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="mt-3 space-y-5 border-t border-slate-100 p-5 pt-0 dark:border-slate-800">
          {/* Combined Teacher Entries for the Day */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Laporan Harian Daripada Pendidik ({report.entries.length} Catatan)
            </h3>

            {report.entries.map((entry, index) => {
              const content = entry.content || {};
              const teacherNotes = content.notes || entry.teacher_notes || entry.notes;
              const mediaUrls: string[] = entry.media_urls || [];

              // Kluster Aktiviti Anak.
              const activityRows = [
                {
                  label: 'Aktiviti Bebas',
                  activity: content.aktiviti_bebas,
                  penglibatan: content.penglibatan_bebas,
                },
                {
                  label: 'Aktiviti Luar',
                  activity: content.aktiviti_luar,
                  penglibatan: content.penglibatan_luar,
                },
                {
                  label: 'Aktiviti PERMATA',
                  activity: content.aktiviti_permata,
                  penglibatan: content.penglibatan_permata,
                },
              ].filter((row) => row.activity || row.penglibatan);

              // Medan kategori lain.
              const detailRows = [
                { label: 'Selera', value: content.appetite },
                {
                  label: 'Tempoh Tidur',
                  value: content.duration ? `${content.duration} jam` : null,
                },
                { label: 'Kualiti Tidur', value: content.quality },
                { label: 'Tingkah Laku', value: content.tingkah_laku },
                { label: 'Kemalangan', value: content.kemalangan },
                { label: 'Kecederaan', value: content.kecederaan },
                { label: 'Kesihatan', value: content.kesihatan },
              ].filter((row) => row.value);

              return (
                <div
                  key={entry.id || index}
                  className="space-y-3 rounded-lg border border-slate-200/70 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                >
                  {/* Category Badge & Entry Header */}
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {entry.category ? entry.category.replace(/_/g, ' ') : `Catatan #${index + 1}`}
                    </span>
                    {entry.created_at && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(entry.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  {/* Kluster Aktiviti Anak */}
                  {activityRows.length > 0 && (
                    <div className="space-y-2">
                      {activityRows.map((row) => (
                        <div key={row.label} className="space-y-1">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {row.label}:{' '}
                            <span className="font-normal text-slate-600 dark:text-slate-400">
                              {row.activity || 'Tiada'}
                            </span>
                          </p>
                          {row.penglibatan && (
                            <span className="inline-block rounded border border-blue-200 bg-white px-2 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300">
                              Penglibatan: {row.penglibatan}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Medan kategori lain */}
                  {detailRows.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {detailRows.map((row) => (
                        <span
                          key={row.label}
                          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                          {row.label}: {row.value}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Catatan Pendidik:</span>
                    <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {teacherNotes || 'Tiada catatan tambahan.'}
                    </p>
                  </div>

                  {/* Media Image Gallery */}
                  {mediaUrls.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200/60 pt-2 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Gambar / Lampiran:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {mediaUrls.map((url, mediaIndex) => {
                          const displayUrl = formatImageUrl(url);
                          const isFailed = failedImages[url];

                          if (isFailed) {
                            return (
                              <a
                                key={mediaIndex}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-24 items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-center text-xs font-medium text-blue-600 underline hover:text-blue-800 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Lihat Gambar {mediaIndex + 1} ↗
                              </a>
                            );
                          }

                          return (
                            <a
                              key={mediaIndex}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative block h-32 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                            >
                              <img
                                src={displayUrl}
                                alt={`Lampiran ${mediaIndex + 1}`}
                                referrerPolicy="no-referrer"
                                onError={() => handleImageError(url)}
                                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-semibold">
                                Buka Gambar ↗
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Unified Parent Review Section for the Entire Day */}
          <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
            {isReviewed ? (
              <div className="space-y-1 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3.5 text-xs text-slate-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-slate-300">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Ulasan / Pengesahan Ibu Bapa Bagi Laporan Ini:
                </span>
                <p className="italic text-slate-600 dark:text-slate-400">
                  {report.parentComment || 'Log harian ini telah disahkan tanpa catatan.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ulasan / Catatan Ibu Bapa (Bagi Keseluruhan Laporan Harian Ini):
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Taip ulasan atau sahkan penerimaan laporan log harian hari ini..."
                  className="w-full rounded-lg border border-slate-300 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-brand-600 py-2.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
                >
                  {isSubmitting ? 'Penghantaran...' : 'Hantar & Sahkan Laporan Harian'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}