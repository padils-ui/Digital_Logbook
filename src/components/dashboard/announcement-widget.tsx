import { ChevronDown, Megaphone } from 'lucide-react';
import { formatDateShort } from '@/lib/week-window';
import type { Announcement } from '@/lib/types';

interface AnnouncementWidgetProps {
  /** Pengumuman yang telah disematkan (sudah diisih, terbaharu dahulu). */
  announcements: Announcement[];
  /** Bilangan maksimum pengumuman yang dipaparkan. */
  limit?: number;
}

/** Tukar cap masa kepada tarikh ISO waktu Malaysia (untuk lencana tarikh). */
function mytDateIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const myt = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return myt.toISOString().slice(0, 10);
}

/**
 * Kad "Pengumuman" pada Papan Pemuka.
 *
 * Hanya pengumuman yang disematkan oleh pentadbir dipaparkan. Kandungan
 * penuh boleh dibuka/tutup menggunakan elemen `<details>` asli pelayar.
 */
export function AnnouncementWidget({
  announcements,
  limit = 5,
}: AnnouncementWidgetProps) {
  const visible = announcements.slice(0, limit);

  return (
    <section className="card p-5" aria-labelledby="announcement-widget-title">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
          <Megaphone className="h-4 w-4" aria-hidden />
        </span>
        <h2
          id="announcement-widget-title"
          className="text-sm font-semibold text-slate-800"
        >
          Pengumuman
        </h2>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Tiada pengumuman disematkan buat masa ini.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-slate-200 bg-white"
            >
              <details className="group">
                <summary className="flex min-h-touch cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                  <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[10px] font-semibold uppercase leading-tight text-brand-700"
                    aria-hidden
                  >
                    {formatDateShort(mytDateIso(item.created_at))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {item.title}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      Pengumuman pusat
                    </span>
                  </span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="whitespace-pre-line border-t border-slate-100 px-3 py-2 text-sm text-slate-600">
                  {item.content}
                </p>
              </details>
            </li>
          ))}
        </ul>
      )}

      {announcements.length > visible.length ? (
        <p className="mt-3 text-xs text-slate-500">
          {announcements.length - visible.length} lagi pengumuman disematkan.
        </p>
      ) : null}
    </section>
  );
}
