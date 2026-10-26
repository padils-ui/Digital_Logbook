'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { runManualAssessment, type PemantauanStudentOption } from '@/app/(dashboard)/admin/pemantauan/actions';

export interface ManualAssessmentTriggerProps {
  students: PemantauanStudentOption[];
  /** Tarikh Isnin bagi minggu yang dipilih pada halaman. */
  weekMonday: string;
  weekLabel: string;
  /** Murid yang disyorkan (log tidak lengkap) — dipilih secara lalai. */
  defaultSelectedIds: string[];
}

export function ManualAssessmentTrigger({
  students,
  weekMonday,
  weekLabel,
  defaultSelectedIds,
}: ManualAssessmentTriggerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelectedIds)
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (student) =>
        student.full_name.toLowerCase().includes(term) ||
        student.class_name.toLowerCase().includes(term)
    );
  }, [students, query]);

  const openModal = () => {
    setFormError(null);
    setNotice(null);
    setOpen(true);
  };

  const toggleStudent = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      filtered.forEach((student) => next.add(student.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const handleSubmit = async () => {
    setSaving(true);
    setFormError(null);
    const result = await runManualAssessment({
      studentIds: Array.from(selected),
      weekMonday,
    });
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error ?? 'Ralat tidak diketahui.');
      return;
    }

    setOpen(false);
    setNotice(
      `Pentaksiran dihantar untuk ${result.dispatched ?? 0} murid. Laporan akan muncul dalam senarai jejak audit apabila selesai.`
    );
    router.refresh();
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button type="button" className="btn btn-primary" onClick={openModal}>
        Jalankan Pentaksiran
      </button>

      {notice ? (
        <p role="status" className="text-xs font-medium text-emerald-700">
          {notice}
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-assessment-title"
            className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <h2
                  id="manual-assessment-title"
                  className="text-base font-bold text-slate-900"
                >
                  Jalankan Pentaksiran Mingguan
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Minggu {weekLabel}. Saluran paip AI akan memproses log minggu ini dan
                  menjana laporan DRAFT untuk murid yang dipilih.
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost px-2"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {formError ? (
                <p
                  role="alert"
                  className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {formError}
                </p>
              ) : null}

              <label htmlFor="manual-assessment-search" className="label">
                Cari murid
              </label>
              <input
                id="manual-assessment-search"
                type="search"
                className="input mb-3"
                placeholder="Nama murid atau kelas"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button type="button" className="btn-ghost px-3 text-xs" onClick={selectAllFiltered}>
                  Pilih semua
                </button>
                <button type="button" className="btn-ghost px-3 text-xs" onClick={clearSelection}>
                  Kosongkan
                </button>
                <span className="ml-auto text-xs font-semibold text-slate-600">
                  {selected.size} dipilih
                </span>
              </div>

              {filtered.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                  Tiada murid sepadan dengan carian.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {filtered.map((student) => {
                    const checked = selected.has(student.id);
                    return (
                      <li key={student.id}>
                        <label className="flex min-h-touch cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={checked}
                            onChange={() => toggleStudent(student.id)}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-900">
                              {student.full_name}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {student.class_name}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={saving || selected.size === 0}
              >
                {saving ? 'Menghantar…' : `Hantar untuk ${selected.size} murid`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
