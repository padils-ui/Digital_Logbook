'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GroupedDailyReport } from '@/app/(dashboard)/parent/page';

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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Clickable Header / Accordion Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-5 flex items-center justify-between hover:bg-slate-50 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-3">
          {/* Chevron Icon */}
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
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
              <span className="text-base font-bold text-slate-800">{report.date}</span>
              <span className="text-xs text-slate-400 font-normal">
                ({report.entries.length} catatan)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">{report.studentName}</p>
          </div>
        </div>

        <div>
          {isReviewed ? (
            <span className="px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              Telah Disahkan
            </span>
          ) : (
            <span className="px-3 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
              Ulasan Diperlukan
            </span>
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-5 pt-0 border-t border-slate-100 space-y-5 mt-3">
          {/* Combined Teacher Entries for the Day */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
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
                  className="bg-slate-50 p-4 rounded-lg border border-slate-200/70 space-y-3"
                >
                  {/* Category Badge & Entry Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded tracking-wide">
                      {entry.category ? entry.category.replace(/_/g, ' ') : `Catatan #${index + 1}`}
                    </span>
                    {entry.created_at && (
                      <span className="text-[10px] text-slate-400">
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
                          <p className="text-xs font-semibold text-slate-800">
                            {row.label}:{' '}
                            <span className="font-normal text-slate-600">
                              {row.activity || 'Tiada'}
                            </span>
                          </p>
                          {row.penglibatan && (
                            <span className="inline-block text-xs bg-white text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium">
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
                          className="text-xs bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-medium"
                        >
                          {row.label}: {row.value}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Catatan Pendidik:</span>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed whitespace-pre-line">
                      {teacherNotes || 'Tiada catatan tambahan.'}
                    </p>
                  </div>

                  {/* Media Image Gallery */}
                  {mediaUrls.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60 space-y-2">
                      <span className="text-xs font-semibold text-slate-700">Gambar / Lampiran:</span>
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
                                className="flex items-center justify-center h-24 p-2 rounded-lg border border-slate-200 bg-white text-blue-600 hover:text-blue-800 text-xs text-center font-medium underline"
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
                              className="group relative h-32 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 block"
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
          <div className="pt-3 border-t border-slate-100">
            {isReviewed ? (
              <div className="bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-100 text-xs text-slate-700 space-y-1">
                <span className="font-semibold text-emerald-800">
                  Ulasan / Pengesahan Ibu Bapa Bagi Laporan Ini:
                </span>
                <p className="italic text-slate-600">
                  {report.parentComment || 'Log harian ini telah disahkan tanpa catatan.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Ulasan / Catatan Ibu Bapa (Bagi Keseluruhan Laporan Harian Ini):
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Taip ulasan atau sahkan penerimaan laporan log harian hari ini..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
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