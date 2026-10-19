/**
 * Rangka pemuatan (skeleton) bagi halaman kehadiran.
 * Dipaparkan secara automatik oleh Next.js semasa data pelayan dimuatkan.
 */
export default function KehadiranLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Memuatkan data kehadiran">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-full max-w-md animate-pulse rounded-md bg-slate-200" />
      </div>

      {/* Penukar tab */}
      <div className="h-14 w-full animate-pulse rounded-xl border border-slate-200 bg-white sm:w-80" />

      {/* Kad statistik */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="card flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-16 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>

      {/* Carta */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="card">
            <div className="mb-4 space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-56 animate-pulse rounded bg-slate-200" />
            </div>
            <div className="h-72 w-full animate-pulse rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>

      <span className="sr-only">Memuatkan…</span>
    </div>
  );
}
