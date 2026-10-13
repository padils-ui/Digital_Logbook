'use client';

import { useMemo, useState, useTransition } from 'react';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import type { ClassRow, Student } from '@/lib/types';
import { StudentModal } from './student-modal';
import {
  createStudent,
  updateStudent,
  deleteStudent,
  type StudentInput,
} from '@/app/(dashboard)/admin/students/actions';

interface StudentTableProps {
  students: Student[];
  classes: ClassRow[];
  classNames: Record<string, string>;
}

/** Jadual pengurusan anak dengan carian, penapis dan CRUD. */
export function StudentTable({
  students,
  classes,
  classNames,
}: StudentTableProps) {
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter !== 'all' && s.class_id !== classFilter) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.nickname ?? '').toLowerCase().includes(q) ||
        (s.mykid_number ?? '').toLowerCase().includes(q)
      );
    });
  }, [students, query, classFilter]);

  function openAdd() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(student: Student) {
    setEditing(student);
    setFormError(null);
    setModalOpen(true);
  }

  function handleSubmit(input: StudentInput) {
    setSaving(true);
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateStudent(editing.id, input)
        : await createStudent(input);
      setSaving(false);
      if (!result.ok) {
        setFormError(result.error ?? 'Ralat tidak diketahui.');
        return;
      }
      setModalOpen(false);
      setEditing(null);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    startTransition(async () => {
      const result = await deleteStudent(deleteTarget.id);
      setDeleting(false);
      if (!result.ok) {
        setActionError(result.error ?? 'Ralat tidak diketahui.');
        return;
      }
      setDeleteTarget(null);
    });
  }

  return (
    <section className="space-y-4">
      {/* Kiraan jumlah anak */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge-slate">
          <Users className="mr-1 h-3.5 w-3.5" aria-hidden />
          {students.length} anak berdaftar
        </span>
        {filtered.length !== students.length && (
          <span className="badge-slate">{filtered.length} dipaparkan</span>
        )}
      </div>

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      {/* Carian & penapis */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau MyKid…"
            aria-label="Cari anak"
            className="input pl-9"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="Tapis mengikut kelas"
          className="input sm:w-52"
        >
          <option value="all">Semua Kelas</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.class_name}
            </option>
          ))}
        </select>
        <button type="button" onClick={openAdd} className="btn shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          Tambah Anak Baru
        </button>
      </div>

      {/* Jadual */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Nama Anak &amp; MyKid
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Kelas / Kumpulan Umur
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Maklumat Penjaga
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Catatan Khas
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Tindakan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Tiada anak sepadan dengan carian anda.
                  </td>
                </tr>
              ) : (
                filtered.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                          {student.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={student.photo_url}
                              alt={student.full_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-slate-500">
                              {student.full_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {student.full_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {student.mykid_number || 'Tiada MyKid'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge-slate">
                        {student.class_id
                          ? classNames[student.class_id] ?? 'Tanpa Kelas'
                          : 'Tanpa Kelas'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">
                        {student.parent_name || '—'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {student.parent_phone || ''}
                      </p>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="line-clamp-2 text-xs text-slate-600">
                        {student.special_notes || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(student)}
                          className="btn-ghost px-2"
                          aria-label={`Sunting ${student.full_name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setDeleteTarget(student);
                          }}
                          className="btn-ghost px-2 text-red-600 hover:bg-red-50"
                          aria-label={`Padam ${student.full_name}`}
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

      {/* Modal tambah / sunting */}
      <StudentModal
        open={modalOpen}
        student={editing}
        classes={classes}
        saving={saving}
        error={formError}
        onClose={() => {
          if (saving) return;
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      {/* Dialog pengesahan padam */}
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
            aria-labelledby="delete-dialog-title"
            className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2
              id="delete-dialog-title"
              className="text-base font-bold text-slate-900"
            >
              Padam Anak?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Adakah anda pasti mahu memadam{' '}
              <span className="font-semibold text-slate-800">
                {deleteTarget.full_name}
              </span>
              ? Tindakan ini tidak boleh dibatalkan.
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
