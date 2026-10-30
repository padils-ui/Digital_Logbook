'use client';

import { useState, useTransition } from 'react';
import { Megaphone, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import type { Announcement } from '@/lib/types';
import { formatDateShort, formatDateTimeMy } from '@/lib/week-window';
import {
  createAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementPin,
  type AnnouncementInput,
} from '@/app/(dashboard)/admin/tetapan/actions';

interface AnnouncementManagerProps {
  announcements: Announcement[];
}

/** Tukar cap masa kepada tarikh ISO waktu Malaysia (untuk lencana tarikh). */
function mytDateIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const myt = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return myt.toISOString().slice(0, 10);
}

/**
 * Kad "Pengumuman Pusat" pada Tetapan PAPN.
 *
 * Pentadbir boleh mencipta, menyemat (pin) dan memadam pengumuman. Hanya
 * pengumuman yang disemat akan muncul pada widget Papan Pemuka.
 */
export function AnnouncementManager({ announcements }: AnnouncementManagerProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pinningId, setPinningId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  const sorted = [...announcements].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return a.created_at < b.created_at ? 1 : -1;
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input: AnnouncementInput = { title, content, is_pinned: isPinned };
    setSaving(true);
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await createAnnouncement(input);
        if (!result.success) {
          setFormError(result.error ?? 'Ralat tidak diketahui.');
          return;
        }
        setTitle('');
        setContent('');
        setIsPinned(true);
      } finally {
        setSaving(false);
      }
    });
  }

  function handleTogglePin(item: Announcement) {
    setPinningId(item.id);
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await toggleAnnouncementPin(item.id, !item.is_pinned);
        if (!result.success) {
          setActionError(result.error ?? 'Ralat tidak diketahui.');
        }
      } finally {
        setPinningId(null);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await deleteAnnouncement(deleteTarget.id);
        if (!result.success) {
          setActionError(result.error ?? 'Ralat tidak diketahui.');
        }
      } finally {
        setDeleteTarget(null);
        setDeleting(false);
      }
    });
  }

  return (
    <section className="space-y-4" aria-labelledby="announcement-manager-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="announcement-manager-title" className="text-base font-bold text-slate-900">
            Pengumuman Pusat
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Pengumuman yang disemat akan dipaparkan pada widget Papan Pemuka.
          </p>
        </div>
        <span className="badge-slate">
          <Megaphone className="mr-1 h-3.5 w-3.5" aria-hidden />
          {announcements.length} pengumuman
        </span>
      </div>

      <div className="card p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {formError}
            </p>
          )}

          <div>
            <label htmlFor="announcement_title" className="label">
              Tajuk
            </label>
            <input
              id="announcement_title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="cth. Cuti Hari Keputeraan Sultan"
              required
              maxLength={120}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="announcement_content" className="label">
              Kandungan
            </label>
            <textarea
              id="announcement_content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
              required
              maxLength={2000}
              placeholder="Maklumat penuh pengumuman untuk ibu bapa dan pendidik."
              className="input"
            />
          </div>

          <label className="flex min-h-touch items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(event) => setIsPinned(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            Sematkan pada Papan Pemuka
          </label>

          <div className="flex justify-end">
            <button type="submit" className="btn" disabled={saving}>
              <Plus className="h-4 w-4" aria-hidden />
              {saving ? 'Menyimpan…' : 'Tambah Pengumuman'}
            </button>
          </div>
        </form>
      </div>

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
          Tiada pengumuman lagi. Tambah pengumuman pertama di atas.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((item) => (
            <li key={item.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-semibold uppercase leading-tight ${
                    item.is_pinned
                      ? 'bg-brand-50 text-brand-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                  aria-hidden
                >
                  {formatDateShort(mytDateIso(item.created_at))}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                    {item.is_pinned && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                        Disemat
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDateTimeMy(item.created_at)}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                    {item.content}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleTogglePin(item)}
                    className="btn-ghost px-2"
                    disabled={pinningId === item.id}
                    aria-label={
                      item.is_pinned
                        ? `Nyahsemat ${item.title}`
                        : `Sematkan ${item.title}`
                    }
                  >
                    {item.is_pinned ? (
                      <PinOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Pin className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setDeleteTarget(item);
                    }}
                    className="btn-ghost px-2 text-red-600 hover:bg-red-50"
                    aria-label={`Padam ${item.title}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => {
              if (!deleting) setDeleteTarget(null);
            }}
            aria-hidden
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-announcement-title"
            className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 id="delete-announcement-title" className="text-base font-bold text-slate-900">
              Padam Pengumuman?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Adakah anda pasti mahu memadam{' '}
              <span className="font-semibold text-slate-800">{deleteTarget.title}</span>?
              Tindakan ini tidak boleh dibatalkan.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn bg-slate-100 text-slate-700 hover:bg-slate-200"
                disabled={deleting}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn bg-red-600 text-white hover:bg-red-700"
                disabled={deleting}
              >
                {deleting ? 'Memadam…' : 'Padam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
