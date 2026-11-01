import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Building2, Clock, ShieldCheck, UserRound } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { PendingApprovalActions } from './pending-approval-actions';

export const metadata: Metadata = {
  title: 'Menunggu Kelulusan',
};

/**
 * Halaman ini membaca profil pengguna semasa dan nama pusat PAPN, jadi ia
 * tidak boleh dijana secara statik semasa proses build.
 */
export const dynamic = 'force-dynamic';

export default async function PendingApprovalPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');

  // Akaun `pending` tidak mempunyai akses penyewa melalui RLS, jadi nama
  // pusat dibaca dengan klien service role.
  const admin = createAdminClient();
  const [settingsRes, tenantRes] = await Promise.all([
    admin
      .from('center_settings')
      .select('center_name')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle(),
    admin
      .from('tenants')
      .select('name')
      .eq('id', profile.tenant_id)
      .maybeSingle(),
  ]);

  // Keutamaan: center_settings.center_name (nama rasmi pusat), kemudian
  // tenants.name. app_name / tajuk aplikasi tidak digunakan kerana ia bukan
  // nama pusat sebenar.
  const centerName =
    settingsRes.data?.center_name?.trim() ||
    tenantRes.data?.name?.trim() ||
    'pusat PAPN anda';

  const rejected = profile.status === 'rejected';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            PERMATALog
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Sistem Pengurusan &amp; Pentaksiran PAPN
          </p>
        </div>

        <div className="card space-y-5 p-6">
          <div className="flex flex-col items-center text-center">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full ${
                rejected
                  ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                  : 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
              }`}
            >
              <Clock className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
              {rejected ? 'Permohonan Ditolak' : 'Akaun Menunggu Kelulusan'}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {rejected
                ? 'Permohonan pendaftaran akaun anda telah ditolak oleh pentadbir PAPN.'
                : 'Permohonan pendaftaran akaun anda sedang disemak oleh Pentadbir PAPN.'}
            </p>
          </div>

          <dl className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-start gap-2">
              <UserRound
                className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                aria-hidden="true"
              />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Nama
                </dt>
                <dd className="text-slate-900 dark:text-slate-100">
                  {profile.full_name}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Building2
                className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                aria-hidden="true"
              />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Pusat PAPN
                </dt>
                <dd className="text-slate-900 dark:text-slate-100">
                  {centerName}
                </dd>
              </div>
            </div>
          </dl>

          {!rejected && (
            <div className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                Sila hubungi pentadbir {centerName} jika kelulusan mengambil
                masa yang lama.
              </p>
            </div>
          )}

          <PendingApprovalActions initialStatus={profile.status} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          PERMATALog &mdash; Pusat Anak PERMATA Negara
        </p>
      </div>
    </main>
  );
}
