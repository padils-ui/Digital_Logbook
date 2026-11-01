import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CenterOption } from '@/lib/types';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: 'Daftar Akaun',
};

// Halaman ini membaca senarai pusat PAPN daripada pangkalan data, jadi ia
// tidak boleh dijana secara statik semasa proses build.
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenants')
    .select('id, name')
    .order('name');

  if (error) {
    console.error('[SignupPage] gagal memuatkan senarai pusat:', error.message);
  }

  // Hanya id dan nama dihantar ke pelayar — Kod Akses Pusat tidak pernah
  // didedahkan kepada klien.
  const centers = (data ?? []) as CenterOption[];

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            PERMATALog
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Pendaftaran Akaun Pusat Anak PERMATA Negara
          </p>
        </div>

        {centers.length === 0 ? (
          <div className="card space-y-2 text-center">
            <Building2
              className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500"
              aria-hidden
            />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Tiada pusat PAPN tersedia
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Pendaftaran belum dibuka. Sila hubungi pentadbir PAPN.
            </p>
          </div>
        ) : (
          <SignupForm centers={centers} />
        )}

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Sudah mempunyai akaun?{' '}
          <Link
            href="/login"
            className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Log masuk
          </Link>
        </p>
      </div>
    </main>
  );
}
