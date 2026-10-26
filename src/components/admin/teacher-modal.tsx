'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ClassRow, TeacherRow } from '@/lib/types';
import type { TeacherInput } from '@/app/(dashboard)/admin/pendidik/actions';

interface TeacherModalProps {
  open: boolean;
  /** Pendidik yang disunting; null bermakna mod tambah. */
  teacher: TeacherRow | null;
  classes: ClassRow[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: TeacherInput) => void;
}

interface FormState {
  full_name: string;
  email: string;
  phone_number: string;
  role: 'teacher' | 'admin_papn';
  is_active: boolean;
  password: string;
  class_ids: string[];
}

const EMPTY_FORM: FormState = {
  full_name: '',
  email: '',
  phone_number: '',
  role: 'teacher',
  is_active: true,
  password: '',
  class_ids: [],
};

/** Dialog borang tambah / sunting pendidik. */
export function TeacherModal({
  open,
  teacher,
  classes,
  saving,
  error,
  onClose,
  onSubmit,
}: TeacherModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Isi semula borang apabila modal dibuka atau pendidik berubah.
  useEffect(() => {
    if (!open) return;
    if (teacher) {
      setForm({
        full_name: teacher.full_name ?? '',
        email: teacher.email ?? '',
        phone_number: teacher.phone_number ?? '',
        role: teacher.role === 'admin_papn' ? 'admin_papn' : 'teacher',
        is_active: teacher.is_active,
        password: '',
        class_ids: teacher.class_ids,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, teacher]);

  if (!open) return null;

  const isEdit = Boolean(teacher);

  function toggleClass(classId: string) {
    setForm((f) => ({
      ...f,
      class_ids: f.class_ids.includes(classId)
        ? f.class_ids.filter((id) => id !== classId)
        : [...f.class_ids, classId],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      full_name: form.full_name,
      email: form.email,
      phone_number: form.phone_number,
      role: form.role,
      is_active: form.is_active,
      password: form.password,
      class_ids: form.class_ids,
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
        aria-labelledby="teacher-modal-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="teacher-modal-title"
            className="text-base font-bold text-slate-900"
          >
            {isEdit ? 'Sunting Pendidik' : 'Tambah Pendidik Baru'}
          </h2>
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

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="teacher_full_name" className="label">
              Nama Penuh
            </label>
            <input
              id="teacher_full_name"
              type="text"
              required
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
              className="input"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="teacher_email" className="label">
                E-mel Log Masuk
              </label>
              <input
                id="teacher_email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="guru@sekolah.edu.my"
                className="input"
              />
              <p className="mt-1 text-xs text-slate-500">
                Kosongkan jika mahu log masuk guna nombor telefon.
              </p>
            </div>
            <div>
              <label htmlFor="teacher_phone" className="label">
                No. Telefon
              </label>
              <input
                id="teacher_phone"
                type="tel"
                value={form.phone_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone_number: e.target.value }))
                }
                placeholder="012-3456789"
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="teacher_role" className="label">
                Peranan
              </label>
              <select
                id="teacher_role"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value as FormState['role'],
                  }))
                }
                className="input"
              >
                <option value="teacher">Pendidik</option>
                <option value="admin_papn">Pentadbir PAPN</option>
              </select>
            </div>
            <div>
              <label htmlFor="teacher_password" className="label">
                {isEdit ? 'Kata Laluan Baharu' : 'Kata Laluan'}
              </label>
              <input
                id="teacher_password"
                type="password"
                required={!isEdit}
                minLength={6}
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder={isEdit ? 'Biarkan kosong untuk kekal' : 'Minimum 6 aksara'}
                className="input"
              />
            </div>
          </div>

          <div>
            <span className="label">Status Akaun</span>
            <label
              htmlFor="teacher_is_active"
              className="flex min-h-touch cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
            >
              <input
                id="teacher_is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">
                Akaun aktif (boleh log masuk)
              </span>
            </label>
          </div>

          <fieldset>
            <legend className="label">Tugasan Kelas</legend>
            {classes.length === 0 ? (
              <p className="text-sm text-slate-500">
                Belum ada kelas. Sila tambah kelas terlebih dahulu.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {classes.map((c) => (
                  <label
                    key={c.id}
                    htmlFor={`class-${c.id}`}
                    className="flex min-h-touch cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <input
                      id={`class-${c.id}`}
                      type="checkbox"
                      checked={form.class_ids.includes(c.id)}
                      onChange={() => toggleClass(c.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">{c.class_name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn bg-slate-100 text-slate-700 hover:bg-slate-200"
              disabled={saving}
            >
              Batal
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving
                ? 'Menyimpan…'
                : isEdit
                  ? 'Simpan Perubahan'
                  : 'Tambah Pendidik'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
