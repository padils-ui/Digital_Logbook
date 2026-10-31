'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { ImageUp, Trash2 } from 'lucide-react';
import { removeLogo, uploadLogo } from '@/app/(dashboard)/admin/tetapan/actions';

/** Had saiz fail selaras dengan dasar baldi `center-assets`. */
const MAX_BYTES = 2 * 1024 * 1024;

interface LogoUploaderProps {
  /** URL awam logo semasa, jika ada. */
  logoUrl: string | null;
}

/**
 * Pemuat naik logo pusat / ikon aplikasi.
 * Baris `center_settings` dicipta secara automatik oleh tindakan pelayan
 * sekiranya belum wujud, jadi butang muat naik sentiasa tersedia.
 */
export function LogoUploader({ logoUrl }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoUrl);
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
        const result = await uploadLogo(formData);
        if (!result.success) {
          setError(result.error ?? 'Ralat tidak diketahui.');
          return;
        }
        setPreviewUrl(result.data?.url ?? null);
        setMessage('Logo pusat berjaya dimuat naik.');
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
        const result = await removeLogo();
        if (!result.success) {
          setError(result.error ?? 'Ralat tidak diketahui.');
          return;
        }
        setPreviewUrl(null);
        setMessage('Logo pusat telah dibuang.');
      } finally {
        setRemoving(false);
        setConfirmRemove(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">Logo Pusat / App Icon</h2>
        <p className="mt-1 text-sm text-slate-600">
          Logo ini menggantikan penjenamaan lalai pada bar sisi dan pengepala
          aplikasi. Format PNG, JPEG atau WEBP sehingga 2 MB.
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
            alt="Pratonton logo pusat"
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-contain p-2"
          />
        ) : (
          <span className="text-sm text-slate-500">Belum ada logo pusat</span>
        )}
      </div>

      <input
        ref={inputRef}
        id="logo_file"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading || removing}
        className="sr-only"
        aria-label="Pilih imej logo pusat"
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
            Buang Logo
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
            aria-labelledby="remove-logo-title"
            className="relative z-10 max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl"
          >
            <h3 id="remove-logo-title" className="text-base font-bold text-slate-900">
              Buang Logo Pusat?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Logo akan dipadam daripada storan dan aplikasi akan kembali
              menggunakan penjenamaan lalai. Tindakan ini tidak boleh dibatalkan.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="btn min-h-touch bg-slate-100 text-slate-700 hover:bg-slate-200"
                disabled={removing}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="btn min-h-touch bg-red-600 text-white hover:bg-red-700"
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
