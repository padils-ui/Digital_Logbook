'use client';

import { useEffect } from 'react';

/**
 * Komponen ralat global (App Router).
 * Menggantikan root layout apabila ralat berlaku di peringkat akar,
 * jadi ia MESTI merender <html> dan <body> sendiri.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/global-error]', error);
  }, [error]);

  return (
    <html lang="ms">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: '#f8fafc',
          color: '#0f172a',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: '420px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
            Ralat Sistem
          </h1>
          <p
            style={{
              marginTop: '8px',
              fontSize: '14px',
              color: '#475569',
            }}
          >
            Maaf, berlaku masalah yang tidak dijangka. Sila cuba lagi.
          </p>

          {error.digest && (
            <p
              style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#94a3b8',
              }}
            >
              Kod rujukan: {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#ffffff',
              background: '#2563eb',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Cuba Lagi
          </button>
        </div>
      </body>
    </html>
  );
}
