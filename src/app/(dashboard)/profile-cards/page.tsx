import type { Metadata } from 'next';
import { IdCard, Printer } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Kad Profil' };

export default async function ProfileCardsPage() {
  const profile = await getCurrentUser();
  const supabase = createClient();

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, nickname, mykid_number, dob, gender, blood_type, photo_url, allergies, classes(class_name)')
    .order('full_name', { ascending: true })
    .limit(24);

  const list = students ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Kad Profil Anak
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pusat: {profile?.full_name ? 'PAPN' : 'PAPN'} — cetak kad untuk
            kegunaan kecemasan.
          </p>
        </div>
        <button type="button" className="btn-primary" disabled>
          <Printer className="h-4 w-4" aria-hidden />
          Cetak Semua
        </button>
      </header>

      {list.length === 0 ? (
        <div className="card flex items-center gap-3">
          <IdCard className="h-5 w-5 text-slate-400" aria-hidden />
          <p className="text-sm text-slate-600">
            Tiada rekod anak dijumpai untuk pusat anda.
          </p>
        </div>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((student) => {
            const className =
              (student.classes as { class_name?: string } | null)
                ?.class_name ?? '—';
            return (
              <article key={student.id} className="card">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
                    {student.full_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-slate-900">
                      {student.full_name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {student.nickname ? `"${student.nickname}" · ` : ''}
                      {className}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-400">No. MyKid</dt>
                    <dd className="font-medium text-slate-700">
                      {student.mykid_number ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Jantina</dt>
                    <dd className="font-medium text-slate-700">
                      {student.gender === 'L'
                        ? 'Lelaki'
                        : student.gender === 'P'
                          ? 'Perempuan'
                          : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Golongan Darah</dt>
                    <dd className="font-medium text-slate-700">
                      {student.blood_type ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Alahan</dt>
                    <dd className="font-medium text-slate-700">
                      {student.allergies?.length
                        ? student.allergies.join(', ')
                        : 'Tiada'}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
