/**
 * Rangka pemuatan (skeleton) bagi halaman Pengurusan Ibu Bapa.
 * Dipaparkan secara automatik oleh Next.js semasa data pelayan dimuatkan.
 */
export default function IbuBapaLoading() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-label="Memuatkan data ibu bapa"
    >
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-full max-w-md animate-pulse rounded-md bg-slate-200" />
      </div>

      {/* Bar carian & tindakan */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="h-11 flex-1 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-slate-200 sm:w-44" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-slate-200 sm:w-52" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-slate-200 sm:w-40" />
      </div>

      {/* Jadual */}
      <div className="card overflow-hidden p-0">
        <div className="h-12 w-full animate-pulse bg-slate-100" />
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex items-center gap-4 px-4 py-4">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" />
              <div className="ml-auto h-6 w-16 animate-pulse rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Memuatkan…</span>
    </div>
  );
}
