/**
 * Rangka pemuatan (skeleton) bagi halaman Tetapan PAPN.
 * Dipaparkan secara automatik oleh Next.js semasa data pelayan dimuatkan.
 */
export default function TetapanLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Memuatkan tetapan pusat">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-full max-w-md animate-pulse rounded-md bg-slate-200" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-4 p-5 lg:col-span-2">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-11 w-full animate-pulse rounded-lg bg-slate-200" />
              </div>
            ))}
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-32 w-full animate-pulse rounded-xl bg-slate-200" />
          <div className="h-11 w-40 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="h-12 w-full animate-pulse bg-slate-100" />
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex items-center gap-3 px-4 py-4">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-28 animate-pulse rounded-full bg-slate-200" />
              <div className="ml-auto h-5 w-16 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Memuatkan…</span>
    </div>
  );
}
