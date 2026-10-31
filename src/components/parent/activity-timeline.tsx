'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Clock,
  ImageOff,
  Moon,
  Stethoscope,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityTimelineEntry, ActivityTimelineKind } from '@/lib/types';

interface KindStyle {
  icon: LucideIcon;
  tone: string;
}

const KIND_STYLE: Record<ActivityTimelineKind, KindStyle> = {
  activity: {
    icon: BookOpen,
    tone: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  },
  meal: {
    icon: UtensilsCrossed,
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  sleep: {
    icon: Moon,
    tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  },
  health: {
    icon: Stethoscope,
    tone: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  },
  attendance: {
    icon: Clock,
    tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
  incident: {
    icon: AlertTriangle,
    tone: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  },
};

/** Tukar pautan paparan Google Drive kepada URL thumbnail yang boleh dipaparkan. */
function formatImageUrl(url: string): string {
  if (!url) return '';

  const idMatch = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
  }

  return url;
}

interface ActivityTimelineProps {
  entries: ActivityTimelineEntry[];
}

/** Garis masa kronologi aktiviti harian anak (paparan ibu bapa). */
export function ActivityTimeline({ entries }: ActivityTimelineProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleImageError = (url: string) => {
    setFailedImages((previous) => ({ ...previous, [url]: true }));
  };

  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const style = KIND_STYLE[entry.kind];
        const Icon = style.icon;

        return (
          <li
            key={entry.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.tone}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {entry.title}
                  </p>
                  <time className="shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {entry.time_label}
                  </time>
                </div>

                {entry.details.length > 0 && (
                  <dl className="mt-2 flex flex-wrap gap-1.5">
                    {entry.details.map((detail) => (
                      <div
                        key={`${entry.id}-${detail.label}`}
                        className="inline-flex items-baseline gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <dt className="font-semibold">{detail.label}:</dt>
                        <dd>{detail.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {entry.description && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {entry.description}
                  </p>
                )}

                {entry.media_urls.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {entry.media_urls.map((url, index) => {
                      if (failedImages[url]) {
                        return (
                          <a
                            key={`${entry.id}-media-${index}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-24 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2 text-center text-[11px] font-medium text-brand-700 hover:underline dark:border-slate-700 dark:bg-slate-800 dark:text-brand-300"
                          >
                            <ImageOff className="h-3.5 w-3.5" aria-hidden />
                            Lihat Gambar {index + 1}
                          </a>
                        );
                      }

                      return (
                        <a
                          key={`${entry.id}-media-${index}`}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-24 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 sm:h-28"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={formatImageUrl(url)}
                            alt={`Lampiran ${index + 1}`}
                            referrerPolicy="no-referrer"
                            onError={() => handleImageError(url)}
                            className="h-full w-full object-cover"
                          />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
