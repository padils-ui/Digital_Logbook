'use client';

import { useState, useTransition } from 'react';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import type { AcademicCalendarRow } from '@/lib/types';
import { formatDateMy, formatDayLabel, getTodayIso } from '@/lib/week-window';
import {
  createCalendarEntry,
  deleteCalendarEntry,
  updateCalendarEntry,
  type CalendarEntryInput,
} from '@/app/(dashboard)/admin/tetapan/actions';

interface AcademicCalendarManagerProps {
  entries: AcademicCalendarRow[];
}

/** Senarai cuti umum / penutupan pusat yang dilangkau oleh enjin pentaksiran. */
export function AcademicCalendarManager({ entries }: AcademicCalendarManagerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicCalendarRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AcademicCalendarRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.date === b.date) return a.event_name.localeCompare(b.event_name);
    return a.date < b.date ? -1 : 1;
  });

  function openAdd() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(entry: AcademicCalendarRow) {
    setEditing(entry);
    setFormError(null);
    setModalOpen(true);
  }

  function handleSubmit(input: CalendarEntryInput) {
    setSaving(true);
    setFormError(null);
    startTransition(async () => {
      try {
        const result = editing
          ? await updateCalendarEntry(editing.id, input)
          : await createCalendarEntry(input);
        if (!result.success) {
          setFormError(result.error ?? 'Ralat tidak diketahui.');
          return;
        }
        setModalOpen(false);
        setEditing(null);
      } finally {
        setSaving(false);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await deleteCalendarEntry(deleteTarget.id);
        if (!result.success) {
          setActionError(result.error ?? 'Ralat tidak diketahui.');
          return;
        }
      } finally {
        setDeleteTarget(null);
        setDeleting(false);
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Takwim Akademik</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tarikh cuti umum atau penutupan pusat akan dilangkau oleh enjin
            pentaksiran mingguan.
          </p>
        </div>
        <button type="button" onClick={openAdd} className="btn">
          <Plus className="h-4 w-4" aria-hidden />
          Tambah Tarikh
        </button>
      </div>

      <span className="badge-slate">
        <CalendarDays className="mr-1 h-3.5 w-3.5" aria-hidden />
        {sortedEntries.length} catatan takwim
      </span>

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Tarikh
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Acara
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Jenis
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Tindakan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    Tiada catatan takwim lagi. Klik &quot;Tambah Tarikh&quot; untuk mula.
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-slate-900">
                        {formatDateMy(entry.date)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDayLabel(entry.date)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{entry.event_name}</td>
                    <td className="px-4 py-3">
                      {entry.is_holiday ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          Cuti / Penutupan
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                          Acara Pusat
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(entry)}
                          className="btn-ghost px-2"
                          aria-label={`Sunting ${entry.event_name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setDeleteTarget(entry);
                          }}
                          className="btn-ghost px-2 text-red-600 hover:bg-red-50"
                          aria-label={`Padam ${entry.event_name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <CalendarModal
          entry={editing}
          saving={saving}
          error={formError}
          onClose={() => {
            if (saving) return;
            setModalOpen(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
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
            aria-labelledby="delete-calendar-title"
            className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 id="delete-calendar-title" className="text-base font-bold text-slate-900">
              Padam Catatan Takwim?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Adakah anda pasti mahu memadam{' '}
              <span className="font-semibold text-slate-800">{deleteTarget.event_name}</span>{' '}
              pada {formatDateMy(deleteTarget.date)}? Tindakan ini tidak boleh dibatalkan.
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

interface CalendarModalProps {
  entry: AcademicCalendarRow | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: CalendarEntryInput) => void;
}

function CalendarModal({ entry, saving, error, onClose, onSubmit }: CalendarModalProps) {
  const [startDate, setStartDate] = useState(entry?.date ?? getTodayIso());
  const [endDate, setEndDate] = useState(entry?.date ?? getTodayIso());
  const [eventName, setEventName] = useState(entry?.event_name ?? '');
  const [isHoliday, setIsHoliday] = useState(entry?.is_holiday ?? true);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      start_date: startDate,
      end_date: endDate,
      event_name: eventName,
      is_holiday: isHoliday,
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <h3 id="calendar-modal-title" className="text-base font-bold text-slate-900">
          {entry ? 'Sunting Catatan Takwim' : 'Tambah Catatan Takwim'}
        </h3>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="calendar_start_date" className="label">
                Tarikh Mula
              </label>
              <input
                id="calendar_start_date"
                type="date"
                value={startDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setStartDate(value);
                  if (endDate < value) setEndDate(value);
                }}
                required
                className="input"
              />
            </div>
            <div>
              <label htmlFor="calendar_end_date" className="label">
                Tarikh Tamat
              </label>
              <input
                id="calendar_end_date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="calendar_event" className="label">
              Nama Acara
            </label>
            <input
              id="calendar_event"
              type="text"
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
              placeholder="cth. Hari Kebangsaan"
              required
              className="input"
            />
          </div>

          <label className="flex min-h-touch items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isHoliday}
              onChange={(event) => setIsHoliday(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600"
            />
            Cuti umum / penutupan pusat (langkau hari ini)
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn bg-slate-100 text-slate-700 hover:bg-slate-200"
            disabled={saving}
          >
            Batal
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
}
