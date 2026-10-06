'use client';

import { useEffect } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

/**
 * Komponen ralat peringkat segmen (App Router).
 * Dipaparkan apabila ralat berlaku dalam segmen laluan semasa.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <TriangleAlert className="h-6 w-6 text-red-600" aria-hidden />
        </div>

        <h1 className="mt-4 text-lg font-bold text-slate-900">
          Maaf, berlaku masalah
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Ralat tidak dijangka semasa memuatkan halaman ini. Sila cuba lagi.
        </p>

        {error.digest && (
          <p className="mt-2 text-xs text-slate-400">
            Kod rujukan: {error.digest}
          </p>
        )}

        <button
          type="button"
          onClick={reset}
          className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 sm:w-auto"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Cuba Lagi
        </button>
      </div>
    </div>
  );
}
