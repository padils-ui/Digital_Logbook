'use client';

import { useState, useTransition } from 'react';
import { GraduationCap, Pencil, Plus, Trash2, UserRound, Users } from 'lucide-react';
import type { ClassRow, TeacherOption } from '@/lib/types';
import {
  createClass,
  updateClass,
  deleteClass,
  type ClassInput,
} from '@/app/(dashboard)/admin/classes/actions';

interface ClassManagerProps {
  classes: ClassRow[];
  /** Bilangan anak bagi setiap kelas: { [classId]: count }. */
  studentCounts: Record<string, number>;
  /** Senarai pendidik yang boleh ditugaskan. */
  teachers: TeacherOption[];
  /** Tugasan pendidik sedia ada: { [classId]: teacherId[] }. */
  teacherIdsByClass: Record<string, string[]>;
}

/** Pengurusan kelas (CRUD) untuk pentadbir PAPN. */
export function ClassManager({
  classes,
  studentCounts,
  teachers,
  teacherIdsByClass,
}: ClassManagerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  /** Peta id pendidik kepada nama penuh. */
  const teacherNameById: Record<string, string> = {};
  teachers.forEach((t) => {
    teacherNameById[t.id] = t.full_name;
  });

  function openAdd() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(cls: ClassRow) {
    setEditing(cls);
    setFormError(null);
    setModalOpen(true);
  }

  function handleSubmit(input: ClassInput) {
    setSaving(true);
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateClass(editing.id, input)
        : await createClass(input);
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
      const result = await deleteClass(deleteTarget.id);
      setDeleting(false);
      if (!result.ok) {
        setActionError(result.error ?? 'Ralat tidak diketahui.');
        setDeleteTarget(null);
        return;
      }
      setDeleteTarget(null);
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="badge-slate">
          <GraduationCap className="mr-1 h-3.5 w-3.5" aria-hidden />
          {classes.length} kelas berdaftar
        </span>
        <button type="button" onClick={openAdd} className="btn">
          <Plus className="h-4 w-4" aria-hidden />
          Tambah Kelas Baru
        </button>
      </div>

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
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Nama Kelas
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Kumpulan Umur
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Bilangan Anak
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Pendidik
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Tindakan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classes.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Tiada kelas lagi. Klik &quot;Tambah Kelas Baru&quot; untuk mula.
                  </td>
                </tr>
              ) : (
                classes.map((cls) => {
                  const count = studentCounts[cls.id] ?? 0;
                  const assigned = (teacherIdsByClass[cls.id] ?? [])
                    .map((id) => ({ id, name: teacherNameById[id] }))
                    .filter((t): t is { id: string; name: string } =>
                      Boolean(t.name)
                    );
                  return (
                    <tr key={cls.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {cls.class_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge-slate">{cls.year} tahun</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                          {count} anak
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {assigned.length === 0 ? (
                          <span className="text-xs text-slate-400">
                            Belum ditugaskan
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {assigned.map((teacher) => (
                              <span
                                key={`${cls.id}-${teacher.id}`}
                                className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800"
                              >
                                <UserRound className="h-3 w-3" aria-hidden />
                                {teacher.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(cls)}
                            className="btn-ghost px-2"
                            aria-label={`Sunting ${cls.class_name}`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActionError(null);
                              setDeleteTarget(cls);
                            }}
                            className="btn-ghost px-2 text-red-600 hover:bg-red-50"
                            aria-label={`Padam ${cls.class_name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <ClassModal
          cls={editing}
          teachers={teachers}
          initialTeacherIds={
            editing ? teacherIdsByClass[editing.id] ?? [] : []
          }
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
            aria-labelledby="delete-class-title"
            className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2
              id="delete-class-title"
              className="text-base font-bold text-slate-900"
            >
              Padam Kelas?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Adakah anda pasti mahu memadam{' '}
              <span className="font-semibold text-slate-800">
                {deleteTarget.class_name}
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

interface ClassModalProps {
  cls: ClassRow | null;
  teachers: TeacherOption[];
  initialTeacherIds: string[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: ClassInput) => void;
}

function ClassModal({
  cls,
  teachers,
  initialTeacherIds,
  saving,
  error,
  onClose,
  onSubmit,
}: ClassModalProps) {
  const [className, setClassName] = useState(cls?.class_name ?? '');
  const [year, setYear] = useState(String(cls?.year ?? 4));
  const [teacherIds, setTeacherIds] = useState<string[]>(initialTeacherIds);

  function toggleTeacher(id: string) {
    setTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      class_name: className,
      year: Number(year),
      teacher_ids: teacherIds,
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
        aria-hidden
      />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-modal-title"
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id="class-modal-title" className="text-base font-bold text-slate-900">
          {cls ? 'Sunting Kelas' : 'Tambah Kelas Baru'}
        </h2>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="class_name"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Nama Kelas
            </label>
            <input
              id="class_name"
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="cth. Kelas 4 Tahun"
              required
              className="input"
            />
          </div>

          <div>
            <label
              htmlFor="year"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Kumpulan Umur (Tahun)
            </label>
            <select
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="input"
            >
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <option key={y} value={y}>
                  {y} tahun
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-slate-700">
              Pendidik Ditugaskan
            </legend>
            {teachers.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Tiada pendidik berdaftar. Tambah pendidik di menu Pengurusan
                Pendidik terlebih dahulu.
              </p>
            ) : (
              <div
                className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1"
                role="group"
                aria-label="Pilih pendidik untuk kelas ini"
              >
                {teachers.map((teacher) => {
                  const checkboxId = `teacher-${teacher.id}`;
                  return (
                    <label
                      key={teacher.id}
                      htmlFor={checkboxId}
                      className="flex min-h-touch cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={teacherIds.includes(teacher.id)}
                        onChange={() => toggleTeacher(teacher.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="truncate">{teacher.full_name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {teacherIds.length} pendidik dipilih
            </p>
          </fieldset>
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
