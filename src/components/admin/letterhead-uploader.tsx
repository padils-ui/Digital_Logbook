'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { ImageUp, Trash2 } from 'lucide-react';
import { removeLetterhead, uploadLetterhead } from '@/app/(dashboard)/admin/tetapan/actions';

/** Had saiz fail selaras dengan dasar baldi `center-assets`. */
const MAX_BYTES = 2 * 1024 * 1024;

interface LetterheadUploaderProps {
  /** URL awam imej semasa, jika ada. */
  letterheadUrl: string | null;
}

/**
 * Pemuat naik imej kepala surat rasmi pusat.
 * Baris `center_settings` dicipta secara automatik oleh tindakan pelayan
 * sekiranya belum wujud, jadi butang muat naik sentiasa tersedia.
 */
export function LetterheadUploader({ letterheadUrl }: LetterheadUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(letterheadUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setMessage(null);

    if (file.size > MAX_BYTES) {
      setError('Saiz imej melebihi 2 MB. Sila kecilkan fail terlebih dahulu.');
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    startTransition(async () => {
      try {
        const result = await uploadLetterhead(formData);
        if (!result.success) {
          setError(result.error ?? 'Ralat tidak diketahui.');
          return;
        }
        setPreviewUrl(result.data?.url ?? null);
        setMessage('Imej kepala surat berjaya dimuat naik.');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    });
  }

  function handleRemove() {
    setRemoving(true);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await removeLetterhead();
        if (!result.success) {
          setError(result.error ?? 'Ralat tidak diketahui.');
          return;
        }
        setPreviewUrl(null);
        setMessage('Imej kepala surat telah dibuang.');
      } finally {
        setRemoving(false);
        setConfirmRemove(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">Kepala Surat</h2>
        <p className="mt-1 text-sm text-slate-600">
          Imej rasmi yang dipaparkan pada laporan PDF. Format PNG, JPEG atau WEBP
          sehingga 2 MB.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {message}
        </p>
      )}

      <div className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="Pratonton kepala surat pusat"
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-contain p-2"
          />
        ) : (
          <span className="text-sm text-slate-500">Belum ada imej kepala surat</span>
        )}
      </div>

      <input
        ref={inputRef}
        id="letterhead_file"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading || removing}
        className="sr-only"
        aria-label="Pilih imej kepala surat"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn min-h-touch"
          disabled={uploading || removing}
        >
          <ImageUp className="h-4 w-4" aria-hidden />
          {uploading ? 'Memuat naik…' : 'Muat Naik Imej'}
        </button>

        {previewUrl && (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="btn min-h-touch bg-red-50 text-red-700 hover:bg-red-100"
            disabled={uploading || removing}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Buang Imej
          </button>
        )}
      </div>

      {confirmRemove && (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => {
              if (!removing) setConfirmRemove(false);
            }}
            aria-hidden
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-letterhead-title"
            className="relative z-10 max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl"
          >
            <h3 id="remove-letterhead-title" className="text-base font-bold text-slate-900">
              Buang Kepala Surat?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Imej akan dipadam daripada storan dan laporan PDF akan dijana tanpa
              kepala surat. Tindakan ini tidak boleh dibatalkan.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="btn bg-slate-100 text-slate-700 hover:bg-slate-200"
                disabled={removing}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="btn bg-red-600 text-white hover:bg-red-700"
                disabled={removing}
              >
                {removing ? 'Memadam…' : 'Buang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
