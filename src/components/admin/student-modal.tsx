'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import type { ClassRow, Student } from '@/lib/types';
import type { StudentInput } from '@/app/(dashboard)/admin/students/actions';

interface StudentModalProps {
  open: boolean;
  /** Murid yang disunting; null bermakna mod tambah. */
  student: Student | null;
  classes: ClassRow[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: StudentInput) => void;
}

interface FormState {
  full_name: string;
  nickname: string;
  mykid_number: string;
  dob: string;
  class_id: string;
  gender: '' | 'L' | 'P';
  parent_name: string;
  parent_phone: string;
  special_notes: string;
  photo_url: string;
}

const EMPTY_FORM: FormState = {
  full_name: '',
  nickname: '',
  mykid_number: '',
  dob: '',
  class_id: '',
  gender: '',
  parent_name: '',
  parent_phone: '',
  special_notes: '',
  photo_url: '',
};

/** Dialog borang tambah / sunting murid. */
export function StudentModal({
  open,
  student,
  classes,
  saving,
  error,
  onClose,
  onSubmit,
}: StudentModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Isi semula borang apabila modal dibuka atau murid berubah.
  useEffect(() => {
    if (!open) return;
    if (student) {
      setForm({
        full_name: student.full_name ?? '',
        nickname: student.nickname ?? '',
        mykid_number: student.mykid_number ?? '',
        dob: student.dob ?? '',
        class_id: student.class_id ?? '',
        gender: student.gender ?? '',
        parent_name: student.parent_name ?? '',
        parent_phone: student.parent_phone ?? '',
        special_notes: student.special_notes ?? '',
        photo_url: student.photo_url ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, student]);

  if (!open) return null;

  const isEdit = Boolean(student);

  /** Baca fail imej sebagai data URL (base64) untuk pratonton & simpanan. */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, photo_url: String(reader.result ?? '') }));
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      full_name: form.full_name,
      nickname: form.nickname,
      mykid_number: form.mykid_number,
      dob: form.dob,
      class_id: form.class_id || null,
      gender: form.gender || null,
      parent_name: form.parent_name,
      parent_phone: form.parent_phone,
      special_notes: form.special_notes,
      photo_url: form.photo_url,
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
        aria-labelledby="student-modal-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="student-modal-title"
            className="text-base font-bold text-slate-900"
          >
            {isEdit ? 'Sunting Murid' : 'Tambah Murid Baru'}
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
          {/* Gambar murid */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {form.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.photo_url}
                  alt="Pratonton gambar murid"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImagePlus className="h-6 w-6 text-slate-400" aria-hidden />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="label mb-0">Gambar Murid</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Muat Naik Gambar
                </button>
                {form.photo_url && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, photo_url: '' }))}
                    className="btn-ghost px-2 text-red-600 hover:bg-red-50"
                  >
                    Buang
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          <div>
            <label htmlFor="full_name" className="label">
              Nama Penuh
            </label>
            <input
              id="full_name"
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
              <label htmlFor="nickname" className="label">
                Nama Panggilan
              </label>
              <input
                id="nickname"
                type="text"
                value={form.nickname}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nickname: e.target.value }))
                }
                className="input"
              />
            </div>
            <div>
              <label htmlFor="mykid_number" className="label">
                No. MyKid
              </label>
              <input
                id="mykid_number"
                type="text"
                value={form.mykid_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mykid_number: e.target.value }))
                }
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="dob" className="label">
                Tarikh Lahir
              </label>
              <input
                id="dob"
                type="date"
                value={form.dob}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dob: e.target.value }))
                }
                className="input"
              />
            </div>
            <div>
              <label htmlFor="gender" className="label">
                Jantina
              </label>
              <select
                id="gender"
                value={form.gender}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    gender: e.target.value as FormState['gender'],
                  }))
                }
                className="input"
              >
                <option value="">— Pilih —</option>
                <option value="L">Lelaki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="class_id" className="label">
              Kelas / Kumpulan Umur
            </label>
            <select
              id="class_id"
              value={form.class_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, class_id: e.target.value }))
              }
              className="input"
            >
              <option value="">— Tiada Kelas —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name}
                </option>
              ))}
            </select>
          </div>

          {/* Maklumat penjaga */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="parent_name" className="label">
                Nama Penjaga
              </label>
              <input
                id="parent_name"
                type="text"
                value={form.parent_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parent_name: e.target.value }))
                }
                className="input"
              />
            </div>
            <div>
              <label htmlFor="parent_phone" className="label">
                No. Telefon Penjaga
              </label>
              <input
                id="parent_phone"
                type="tel"
                value={form.parent_phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parent_phone: e.target.value }))
                }
                placeholder="012-3456789"
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="special_notes" className="label">
              Catatan Khas (Alahan / Perubatan)
            </label>
            <textarea
              id="special_notes"
              rows={3}
              value={form.special_notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, special_notes: e.target.value }))
              }
              placeholder="Contoh: Alahan kacang tanah. Perlu ubat asthma."
              className="input resize-none"
            />
          </div>

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
              {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Tambah Murid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
