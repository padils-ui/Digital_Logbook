'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Link2, Search, ShieldCheck, Unlink, X } from 'lucide-react';
import type {
  ParentRow,
  ParentStudentMapRow,
  StudentOption,
} from '@/lib/types';
import {
  linkChild,
  setPrimaryGuardian,
  unlinkChild,
} from '@/app/(dashboard)/admin/ibu-bapa/actions';

interface ChildLinkageProps {
  open: boolean;
  /** Ibu bapa yang sedang diurus pautannya. */
  parent: ParentRow | null;
  students: StudentOption[];
  classNames: Record<string, string>;
  /** Semua pautan anak dalam tenant. */
  links: ParentStudentMapRow[];
  onClose: () => void;
}

const RELATIONSHIP_OPTIONS = ['Ibu', 'Bapa', 'Penjaga', 'Waris'];

/** Modal paut / lepas anak kepada profil ibu bapa. */
export function ChildLinkage({
  open,
  parent,
  students,
  classNames,
  links,
  onClose,
}: ChildLinkageProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [relationship, setRelationship] = useState('Ibu');
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [busyMapId, setBusyMapId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Set semula borang setiap kali modal dibuka untuk ibu bapa berlainan.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedId('');
    setRelationship('Ibu');
    setIsPrimary(false);
    setError(null);
    setBusyMapId(null);
  }, [open, parent?.id]);

  const parentLinks = useMemo(() => {
    if (!parent) return [];
    return links.filter((l) => l.parent_id === parent.id);
  }, [links, parent]);

  const linkedStudentIds = useMemo(
    () => new Set(parentLinks.map((l) => l.student_id)),
    [parentLinks]
  );

  const studentById = useMemo(() => {
    const map: Record<string, StudentOption> = {};
    students.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [students]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return students
      .filter((s) => !linkedStudentIds.has(s.id))
      .filter((s) => {
        const name = s.full_name.toLowerCase();
        const nickname = (s.nickname ?? '').toLowerCase();
        const mykid = (s.mykid_number ?? '').toLowerCase();
        return (
          name.includes(q) || nickname.includes(q) || mykid.includes(q)
        );
      })
      .slice(0, 6);
  }, [students, linkedStudentIds, query]);

  if (!open || !parent) return null;

  const parentId = parent.id;

  function resetSelection() {
    setSelectedId('');
    setQuery('');
    setIsPrimary(false);
  }

  function handleLink() {
    if (!selectedId) {
      setError('Sila pilih anak terlebih dahulu.');
      return;
    }
    setLinking(true);
    setError(null);
    startTransition(async () => {
      const result = await linkChild(
        parentId,
        selectedId,
        relationship,
        isPrimary
      );
      setLinking(false);
      if (!result.ok) {
        setError(result.error ?? 'Ralat tidak diketahui.');
        return;
      }
      resetSelection();
    });
  }

  function handleUnlink(mapId: string) {
    setBusyMapId(mapId);
    setError(null);
    startTransition(async () => {
      const result = await unlinkChild(mapId);
      setBusyMapId(null);
      if (!result.ok) {
        setError(result.error ?? 'Ralat tidak diketahui.');
      }
    });
  }

  function handleSetPrimary(mapId: string) {
    setBusyMapId(mapId);
    setError(null);
    startTransition(async () => {
      const result = await setPrimaryGuardian(mapId);
      setBusyMapId(null);
      if (!result.ok) {
        setError(result.error ?? 'Ralat tidak diketahui.');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="child-linkage-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="child-linkage-title"
              className="text-base font-bold text-slate-900"
            >
              Pautan Anak
            </h2>
            <p className="mt-1 text-sm text-slate-600">{parent.full_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost px-2"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {/* Anak yang sudah dipautkan */}
        <section className="mb-5">
          <h3 className="label">Anak Dipautkan</h3>
          {parentLinks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
              Belum ada anak dipautkan.
            </p>
          ) : (
            <ul className="space-y-2">
              {parentLinks.map((link) => {
                const student = studentById[link.student_id];
                const className = student?.class_id
                  ? classNames[student.class_id]
                  : null;
                const busy = busyMapId === link.id;
                return (
                  <li
                    key={link.id}
                    className="rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {student?.full_name ?? 'Anak'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {[link.relationship_type, className]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {link.is_primary ? (
                          <span className="badge-emerald">
                            <ShieldCheck
                              className="mr-1 h-3.5 w-3.5"
                              aria-hidden
                            />
                            Penjaga Utama
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(link.id)}
                            disabled={busy}
                            className="btn-ghost px-2 text-xs"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                            Jadikan Utama
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleUnlink(link.id)}
                          disabled={busy}
                          className="btn-ghost px-2 text-xs text-red-600 hover:bg-red-50"
                          aria-label={`Lepaskan ${student?.full_name ?? 'anak'}`}
                        >
                          <Unlink className="h-3.5 w-3.5" aria-hidden />
                          Lepaskan
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Carian anak untuk dipautkan */}
        <section className="space-y-3 border-t border-slate-200 pt-4">
          <div>
            <label htmlFor="child_search" className="label">
              Cari Anak
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                id="child_search"
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedId('');
                }}
                placeholder="Cari nama atau No. MyKid…"
                className="input pl-9"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Taip sekurang-kurangnya 2 aksara untuk mencari.
            </p>
          </div>

          {query.trim().length >= 2 && (
            <div>
              {results.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-sm text-slate-500">
                  Tiada anak sepadan atau semua sudah dipautkan.
                </p>
              ) : (
                <ul className="space-y-1">
                  {results.map((s) => {
                    const selected = selectedId === s.id;
                    const className = s.class_id ? classNames[s.class_id] : null;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(s.id)}
                          aria-pressed={selected}
                          className={`flex min-h-touch w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left ${
                            selected
                              ? 'border-slate-900 bg-slate-50'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-900">
                              {s.full_name}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {[s.mykid_number, className]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </span>
                          </span>
                          {selected && (
                            <Link2
                              className="h-4 w-4 shrink-0 text-slate-900"
                              aria-hidden
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {selectedId && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <label htmlFor="child_relationship" className="label">
                  Hubungan
                </label>
                <select
                  id="child_relationship"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="input"
                >
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <label
                htmlFor="child_is_primary"
                className="flex min-h-touch cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <input
                  id="child_is_primary"
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">
                  Jadikan penjaga utama
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetSelection}
                  className="btn bg-white text-slate-700 hover:bg-slate-100"
                  disabled={linking}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleLink}
                  className="btn"
                  disabled={linking}
                >
                  <Link2 className="h-4 w-4" aria-hidden />
                  {linking ? 'Memautkan…' : 'Pautkan Anak'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
