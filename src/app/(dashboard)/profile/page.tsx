import type { Metadata } from 'next';
import { IdCard, Mail, Phone, UserRound } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Student, UserRole } from '@/lib/types';

export const metadata: Metadata = { title: 'Kad Profil' };

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin_papn: 'Pentadbir PAPN',
  teacher: 'Guru / Pengasuh',
  parent: 'Ibu Bapa / Penjaga',
};

export default async function ProfilePage() {
  const profile = await getCurrentUser();

  // Klien admin (service role) untuk bacaan selamat — memintas rekursi RLS.
  const admin = createAdminClient();

  // E-mel diambil daripada auth.users (jadual `users` tidak menyimpannya).
  let email: string | null = null;
  if (profile) {
    const { data } = await admin.auth.admin.getUserById(profile.id);
    email = data.user?.email ?? null;
  }

  // Pautan anak: padankan students.parent_phone dengan users.phone_number.
  let children: Student[] = [];
  if (profile?.phone_number) {
    const { data } = await admin
      .from('students')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('parent_phone', profile.phone_number)
      .order('full_name');
    children = (data ?? []) as Student[];
  }

  const details = [
    { label: 'Nama Penuh', value: profile?.full_name ?? '—', icon: UserRound },
    {
      label: 'Peranan',
      value: profile ? ROLE_LABEL[profile.role] : '—',
      icon: IdCard,
    },
    { label: 'E-mel', value: email ?? '—', icon: Mail },
    {
      label: 'No. Telefon',
      value: profile?.phone_number ?? '—',
      icon: Phone,
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Kad Profil
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Maklumat peribadi dan anak yang dipautkan.
        </p>
      </header>

      <section className="card">
        <h2 className="text-sm font-semibold text-slate-800">
          Maklumat Pengguna
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {details.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-400">{item.label}</dt>
                  <dd className="truncate text-sm font-medium text-slate-800">
                    {item.value}
                  </dd>
                </div>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">
          Anak Dipautkan
        </h2>

        {children.length === 0 ? (
          <div className="card flex items-center gap-3">
            <IdCard className="h-5 w-5 text-slate-400" aria-hidden />
            <p className="text-sm text-slate-600">
              Tiada maklumat anak dipautkan
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {children.map((child) => (
              <article key={child.id} className="card">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-base font-bold text-brand-700">
                    {child.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={child.photo_url}
                        alt={child.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      child.full_name.charAt(0).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-900">
                      {child.full_name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {child.mykid_number ?? 'Tiada MyKid'}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
