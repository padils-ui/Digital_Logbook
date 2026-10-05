import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpenText, IdCard, Megaphone, Users } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Papan Pemuka' };

export default async function DashboardPage() {
  const profile = await getCurrentUser();
  const tenantId = profile?.tenant_id ?? '';

  // Klien admin (service role) untuk bacaan selamat — memintas rekursi RLS
  // pada jadual `users`. Setiap pertanyaan ditapis mengikut tenant_id.
  const admin = createAdminClient();

  const today = new Date().toISOString().slice(0, 10);

  const [students, classes, logs, announcements] = await Promise.all([
    admin
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    admin
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    admin
      .from('daily_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('log_date', today),
    admin
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
  ]);

  const stats = [
    {
      label: 'Jumlah Anak',
      value: students.count ?? 0,
      icon: Users,
      tone: 'bg-brand-50 text-brand-700',
      href: '/admin/students',
    },
    {
      label: 'Jumlah Kelas',
      value: classes.count ?? 0,
      icon: BookOpenText,
      tone: 'bg-emerald-50 text-emerald-700',
      href: '/admin/students',
    },
    {
      label: 'Log Harian',
      value: logs.count ?? 0,
      icon: IdCard,
      tone: 'bg-amber-50 text-amber-700',
      href: '/teacher',
    },
    {
      label: 'Pengumuman',
      value: announcements.count ?? 0,
      icon: Megaphone,
      tone: 'bg-purple-50 text-purple-700',
      href: '/dashboard',
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Papan Pemuka Pentadbir
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Selamat datang, {profile?.full_name ?? 'Pentadbir'}.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-brand-500 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${stat.tone}`}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-3 text-2xl font-bold text-slate-900 transition-colors group-hover:text-brand-600">
                {stat.value}
              </p>
              <p className="text-xs text-slate-500 transition-colors group-hover:text-brand-600">
                {stat.label}
              </p>
            </Link>
          );
        })}
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold text-slate-800">
          Pengurusan Pusat
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Modul pengurusan kelas, pendaftaran anak dan pengurusan pengguna akan
          ditambah pada fasa seterusnya.
        </p>
      </section>
    </div>
  );
}
