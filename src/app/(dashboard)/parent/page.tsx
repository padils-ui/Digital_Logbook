import type { Metadata } from 'next';
import { Bell, CalendarCheck, TriangleAlert } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Ruang Ibu Bapa' };

export default async function ParentPage() {
  const profile = await getCurrentUser();
  const supabase = createClient();

  // RLS mengehadkan baris kepada anak yang dipautkan dengan parent_id ini.
  const { data: links } = await supabase
    .from('student_parents')
    .select('student_id, students(id, full_name, nickname, photo_url)')
    .eq('parent_id', profile?.id ?? '');

  const children = (links ?? [])
    .map((row) => row.students)
    .filter(Boolean)
    .flat() as unknown as {
    id: string;
    full_name: string;
    nickname: string | null;
    photo_url: string | null;
  }[];

  const childIds = children.map((c) => c.id);

  const [logs, incidents, announcements] = await Promise.all([
    childIds.length
      ? supabase
          .from('daily_logs')
          .select('id', { count: 'exact', head: true })
          .in('student_id', childIds)
      : Promise.resolve({ count: 0 }),
    childIds.length
      ? supabase
          .from('incident_reports')
          .select('id', { count: 'exact', head: true })
          .in('student_id', childIds)
          .eq('acknowledged_by_parent', false)
      : Promise.resolve({ count: 0 }),
    supabase.from('announcements').select('id', { count: 'exact', head: true }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Ruang Ibu Bapa / Penjaga
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Selamat datang, {profile?.full_name ?? 'Ibu Bapa'}.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <CalendarCheck className="h-5 w-5 text-brand-600" aria-hidden />
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {logs.count ?? 0}
          </p>
          <p className="text-xs text-slate-500">Rekod log anak anda</p>
        </div>
        <div className="card">
          <TriangleAlert className="h-5 w-5 text-amber-600" aria-hidden />
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {incidents.count ?? 0}
          </p>
          <p className="text-xs text-slate-500">Insiden perlu diakui</p>
        </div>
        <div className="card">
          <Bell className="h-5 w-5 text-purple-600" aria-hidden />
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {announcements.count ?? 0}
          </p>
          <p className="text-xs text-slate-500">Pengumuman pusat</p>
        </div>
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold text-slate-800">Anak Saya</h2>
        {children.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            Tiada anak dipautkan pada akaun anda. Sila hubungi pentadbir PAPN.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {children.map((child) => (
              <li
                key={child.id}
                className="flex min-h-touch items-center gap-3 py-2"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {child.full_name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {child.full_name}
                  </span>
                  {child.nickname ? (
                    <span className="block text-xs text-slate-500">
                      Panggilan: {child.nickname}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
