/**
 * Rangka pemuatan (skeleton) bagi halaman Pemantauan Log & AI.
 * Dipaparkan secara automatik oleh Next.js semasa data pelayan dimuatkan.
 */
export default function PemantauanLoading() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-label="Memuatkan data pemantauan"
    >
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-full max-w-md animate-pulse rounded-md bg-slate-200" />
      </div>

      {/* Navigasi minggu & tab */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <div className="h-11 w-32 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-11 w-56 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-11 w-32 animate-pulse rounded-lg bg-slate-200" />
        </div>
        <div className="h-11 w-full animate-pulse rounded-xl bg-slate-200 sm:w-64" />
      </div>

      {/* Kad amaran log tidak lengkap */}
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-56 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-full max-w-lg animate-pulse rounded bg-slate-200" />
          </div>
          <div className="h-11 w-40 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* Jadual matriks kepatuhan */}
      <div className="card overflow-hidden p-0">
        <div className="h-12 w-full animate-pulse bg-slate-100" />
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="flex items-center gap-3 px-4 py-4">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-14 animate-pulse rounded-full bg-slate-200" />
              <div className="h-6 w-14 animate-pulse rounded-full bg-slate-200" />
              <div className="h-6 w-14 animate-pulse rounded-full bg-slate-200" />
              <div className="h-6 w-14 animate-pulse rounded-full bg-slate-200" />
              <div className="h-6 w-14 animate-pulse rounded-full bg-slate-200" />
              <div className="ml-auto h-5 w-12 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Memuatkan…</span>
    </div>
  );
}
