'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ParentRow } from '@/lib/types';
import type { ParentInput } from '@/app/(dashboard)/admin/ibu-bapa/actions';

interface ParentModalProps {
  open: boolean;
  /** Ibu bapa yang disunting; null bermakna mod tambah. */
  parent: ParentRow | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: ParentInput) => void;
}

interface FormState {
  full_name: string;
  email: string;
  phone_number: string;
  is_active: boolean;
  password: string;
}

const EMPTY_FORM: FormState = {
  full_name: '',
  email: '',
  phone_number: '',
  is_active: true,
  password: '',
};

/** Dialog borang tambah / sunting ibu bapa. */
export function ParentModal({
  open,
  parent,
  saving,
  error,
  onClose,
  onSubmit,
}: ParentModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Isi semula borang apabila modal dibuka atau ibu bapa berubah.
  useEffect(() => {
    if (!open) return;
    if (parent) {
      setForm({
        full_name: parent.full_name ?? '',
        email: parent.email ?? '',
        phone_number: parent.phone_number ?? '',
        is_active: parent.is_active,
        password: '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, parent]);

  if (!open) return null;

  const isEdit = Boolean(parent);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      full_name: form.full_name,
      email: form.email,
      phone_number: form.phone_number,
      is_active: form.is_active,
      password: form.password,
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
        aria-labelledby="parent-modal-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="parent-modal-title"
            className="text-base font-bold text-slate-900"
          >
            {isEdit ? 'Sunting Ibu Bapa' : 'Tambah Ibu Bapa Baru'}
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
            <label htmlFor="parent_full_name" className="label">
              Nama Penuh
            </label>
            <input
              id="parent_full_name"
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
              <label htmlFor="parent_email" className="label">
                E-mel Log Masuk
              </label>
              <input
                id="parent_email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="ibubapa@email.com"
                className="input"
              />
              <p className="mt-1 text-xs text-slate-500">
                Kosongkan jika mahu log masuk guna nombor telefon.
              </p>
            </div>
            <div>
              <label htmlFor="parent_phone" className="label">
                No. Telefon
              </label>
              <input
                id="parent_phone"
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

          <div>
            <label htmlFor="parent_password" className="label">
              {isEdit ? 'Kata Laluan Baharu' : 'Kata Laluan'}
            </label>
            <input
              id="parent_password"
              type="password"
              required={!isEdit}
              minLength={6}
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder={
                isEdit ? 'Biarkan kosong untuk kekal' : 'Minimum 6 aksara'
              }
              className="input"
            />
          </div>

          <div>
            <span className="label">Status Akaun</span>
            <label
              htmlFor="parent_is_active"
              className="flex min-h-touch cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
            >
              <input
                id="parent_is_active"
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
                  : 'Tambah Ibu Bapa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
