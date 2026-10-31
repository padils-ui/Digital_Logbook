import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  IdCard,
  Phone,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { calculateAge } from '@/lib/log-categories';
import { formatDateMy } from '@/lib/week-window';

export const metadata: Metadata = { title: 'Kad Profil Anak' };

/** Satu rekod anak berserta nama kelas daripada jadual `classes`. */
interface ChildProfileRow {
  id: string;
  full_name: string;
  nickname: string | null;
  mykid_number: string | null;
  dob: string | null;
  gender: 'L' | 'P' | null;
  blood_type: string | null;
  photo_url: string | null;
  allergies: string[] | null;
  medical_conditions: string | null;
  special_notes: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  classes: { class_name: string | null } | { class_name: string | null }[] | null;
}

/** Ambil nama kelas sama ada PostgREST memulangkan objek atau tatasusunan. */
function resolveClassName(
  classes: ChildProfileRow['classes']
): string | null {
  if (!classes) return null;
  const row = Array.isArray(classes) ? classes[0] : classes;
  return row?.class_name ?? null;
}

/** Satu pasangan label/nilai dalam kad profil. */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">
        {value}
      </dd>
    </div>
  );
}

export default async function ParentProfilePage() {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');
  if (profile.role !== 'parent') redirect('/dashboard');

  const supabase = createClient();

  // Anak yang dipautkan — kesatuan kedua-dua jadual pautan (RLS menapis).
  const [mapRes, legacyRes] = await Promise.all([
    supabase
      .from('parent_student_map')
      .select('student_id')
      .eq('parent_id', profile.id),
    supabase
      .from('student_parents')
      .select('student_id')
      .eq('parent_id', profile.id),
  ]);

  const linkedIds = Array.from(
    new Set(
      [
        ...((mapRes.data ?? []) as { student_id: string | null }[]),
        ...((legacyRes.data ?? []) as { student_id: string | null }[]),
      ]
        .map((row) => row.student_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const { data: childData } =
    linkedIds.length > 0
      ? await supabase
          .from('students')
          .select(
            'id, full_name, nickname, mykid_number, dob, gender, blood_type, photo_url, allergies, medical_conditions, special_notes, parent_name, parent_phone, classes(class_name)'
          )
          .in('id', linkedIds)
          .order('full_name', { ascending: true })
      : { data: [] as ChildProfileRow[] };

  const children = (childData ?? []) as ChildProfileRow[];

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/parent"
          className="inline-flex min-h-touch items-center gap-2 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali ke Papan Pemuka
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          Kad Profil Anak
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
          Maklumat Anak &amp; Kecemasan
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Simpan maklumat ini untuk kegunaan kecemasan dan rujukan pusat PAPN.
        </p>
      </header>

      {children.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <IdCard
            className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500"
            aria-hidden
          />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tiada rekod anak dipautkan ke akaun anda. Sila hubungi pentadbir
            pusat PAPN.
          </p>
        </div>
      ) : (
        <section
          aria-label="Kad profil anak"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {children.map((child) => {
            const className = resolveClassName(child.classes);
            const age = calculateAge(child.dob);
            const initials = child.full_name
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? '')
              .join('');

            return (
              <article
                key={child.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Pengepala kad */}
                <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  {child.photo_url ? (
                    <img
                      src={child.photo_url}
                      alt={child.full_name}
                      referrerPolicy="no-referrer"
                      className="h-14 w-14 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      {initials || '?'}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                      {child.full_name}
                    </h2>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {child.nickname ? `"${child.nickname}" · ` : ''}
                      {className ?? 'Kelas belum ditetapkan'}
                    </p>
                    {age !== null ? (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {age} tahun
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-4">
                  {/* Maklumat peribadi */}
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <IdCard className="h-3.5 w-3.5" aria-hidden />
                      Maklumat Peribadi
                    </h3>
                    <dl className="grid grid-cols-2 gap-3">
                      <InfoRow
                        label="No. MyKid"
                        value={child.mykid_number ?? '—'}
                      />
                      <InfoRow
                        label="Tarikh Lahir"
                        value={child.dob ? formatDateMy(child.dob) : '—'}
                      />
                      <InfoRow
                        label="Jantina"
                        value={
                          child.gender === 'L'
                            ? 'Lelaki'
                            : child.gender === 'P'
                              ? 'Perempuan'
                              : '—'
                        }
                      />
                      <InfoRow
                        label="Golongan Darah"
                        value={child.blood_type ?? '—'}
                      />
                    </dl>
                  </div>

                  {/* Maklumat kesihatan */}
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <Stethoscope className="h-3.5 w-3.5" aria-hidden />
                      Maklumat Kesihatan
                    </h3>
                    <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      <ShieldAlert className="h-3 w-3" aria-hidden />
                      Alahan
                    </p>
                    {child.allergies && child.allergies.length > 0 ? (
                      <ul className="mb-2 flex flex-wrap gap-1.5">
                        {child.allergies.map((allergy) => (
                          <li
                            key={allergy}
                            className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
                          >
                            {allergy}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                        Tiada alahan direkodkan
                      </p>
                    )}
                    <dl className="space-y-2">
                      <InfoRow
                        label="Keadaan Perubatan"
                        value={child.medical_conditions || 'Tiada'}
                      />
                      <InfoRow
                        label="Catatan Khas"
                        value={child.special_notes || 'Tiada'}
                      />
                    </dl>
                  </div>

                  {/* Hubungan kecemasan */}
                  <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      Hubungan Kecemasan
                    </h3>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {child.parent_name || profile.full_name}
                    </p>
                    {child.parent_phone ? (
                      <a
                        href={`tel:${child.parent_phone}`}
                        className="mt-1 inline-flex min-h-touch items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        <Phone className="h-4 w-4" aria-hidden />
                        {child.parent_phone}
                      </a>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        No. telefon belum direkodkan
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/parent/today?student=${child.id}`}
                    className="btn-ghost w-full text-xs"
                  >
                    <Activity className="h-4 w-4" aria-hidden />
                    Lihat Aktiviti Hari Ini
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
