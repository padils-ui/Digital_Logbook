import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LogSummaryCard } from '@/components/parent/log-summary-card';
import type { GroupedDailyReport } from '@/lib/types';

export const metadata: Metadata = { title: 'Log Harian & Ulasan' };

export default async function ParentLogsPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');
  if (profile.role !== 'parent') redirect('/dashboard');

  const supabase = createClient();

  // 1. Anak yang dipautkan — kesatuan kedua-dua jadual pautan (RLS menapis).
  const [mapRes, legacyRes] = await Promise.all([
    supabase.from('parent_student_map').select('student_id').eq('parent_id', profile.id),
    supabase.from('student_parents').select('student_id').eq('parent_id', profile.id),
  ]);

  const studentIds = Array.from(
    new Set(
      [
        ...((mapRes.data ?? []) as { student_id: string | null }[]),
        ...((legacyRes.data ?? []) as { student_id: string | null }[]),
      ]
        .map((row) => row.student_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let rawLogs: any[] = [];

  // 2. Semua log mentah bagi anak yang dipautkan.
  if (studentIds.length > 0) {
    const { data } = await supabase
      .from('daily_logs')
      .select(
        `
        *,
        students (
          full_name
        )
      `
      )
      .in('student_id', studentIds)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: true });

    rawLogs = data || [];
  }

  // 3. Kumpulkan log mengikut tarikh dan anak.
  const groupedMap = new Map<string, GroupedDailyReport>();

  rawLogs.forEach((log: any) => {
    const key = `${log.log_date}_${log.student_id}`;

    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        date: log.log_date,
        studentId: log.student_id,
        studentName: log.students?.full_name || 'Anak',
        logIds: [],
        isReviewed: true,
        parentComment: null,
        entries: [],
      });
    }

    const group = groupedMap.get(key)!;
    group.logIds.push(log.id);
    group.entries.push(log);

    if (!log.parent_reviewed) {
      group.isReviewed = false;
    }

    if (log.parent_comment) {
      group.parentComment = log.parent_comment;
    }
  });

  const dailyReports = Array.from(groupedMap.values());
  const pendingCount = dailyReports.filter((report) => !report.isReviewed).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          href="/parent"
          className="inline-flex min-h-touch items-center gap-2 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali ke Papan Pemuka
        </Link>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Arkib Log Mingguan
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              Log Harian &amp; Ulasan
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Semak dan berikan ulasan bagi laporan harian anak anda.
            </p>
          </div>
          {pendingCount > 0 ? (
            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              {pendingCount} Laporan Memerlukan Ulasan
            </div>
          ) : (
            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Semua Laporan Telah Disahkan
            </div>
          )}
        </div>
      </header>

      {dailyReports.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Tiada log harian dijumpai buat masa ini.
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Log akan dipaparkan sebaik sahaja pendidik menghantar laporan harian.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {dailyReports.map((report) => (
            <LogSummaryCard key={`${report.date}_${report.studentId}`} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
