import { WifiOff } from 'lucide-react';

export const metadata = { title: 'Luar Talian' };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff className="h-10 w-10 text-slate-400" aria-hidden />
      <h1 className="text-lg font-bold text-slate-900">Tiada Sambungan Internet</h1>
      <p className="max-w-sm text-sm text-slate-600">
        Sila semak sambungan anda. Halaman yang telah dilawati mungkin masih
        boleh diakses secara luar talian.
      </p>
    </main>
  );
}
