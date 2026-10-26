import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { loadPemantauanData } from '@/app/(dashboard)/admin/pemantauan/actions';
import { LogComplianceMatrix } from '@/components/admin/log-compliance-matrix';
import { MissingLogAlert } from '@/components/admin/missing-log-alert';
import { AssessmentAuditTrail } from '@/components/admin/assessment-audit-trail';
import {
  formatWeekRange,
  normalizeWeekParam,
  shiftWeek,
} from '@/lib/week-window';

export const metadata: Metadata = { title: 'Pemantauan Log & AI' };

type PemantauanTab = 'matrix' | 'audit';

const TAB_OPTIONS: { value: PemantauanTab; label: string }[] = [
  { value: 'matrix', label: 'Kepatuhan Log' },
  { value: 'audit', label: 'Jejak Audit' },
];

/** Sahkan tab aktif; lalai kepada matriks kepatuhan. */
function normalizeTabParam(value: string | string[] | undefined): PemantauanTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'audit' ? 'audit' : 'matrix';
}

/** Bina pautan sambil mengekalkan minggu dan tab aktif. */
function buildHref(tab: PemantauanTab, weekMonday: string): string {
  const params = new URLSearchParams({ week: weekMonday, tab });
  return `/admin/pemantauan?${params.toString()}`;
}

export default async function AdminPemantauanPage({
  searchParams,
}: {
  searchParams?: {
    week?: string | string[];
    tab?: string | string[];
  };
}) {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin_papn' && profile.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const weekMonday = normalizeWeekParam(searchParams?.week);
  const activeTab = normalizeTabParam(searchParams?.tab);
  const result = await loadPemantauanData(weekMonday);

  const studentNames: Record<string, string> = {};
  if (result.ok) {
    result.data.students.forEach((student) => {
      studentNames[student.id] = student.full_name;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <header>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Pemantauan Log &amp; AI
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pantau kepatuhan pengisian log harian dan jejak audit pemprosesan AI.
          </p>
        </header>

        {result.ok ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildHref(activeTab, shiftWeek(weekMonday, -1))}
              className="btn-ghost"
              aria-label="Minggu sebelumnya"
            >
              ← Minggu Lepas
            </Link>
            <span className="inline-flex min-h-touch items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800">
              Minggu {result.data.week.weekNumber} · {formatWeekRange(result.data.week)}
            </span>
            <Link
              href={buildHref(activeTab, shiftWeek(weekMonday, 1))}
              className="btn-ghost"
              aria-label="Minggu seterusnya"
            >
              Minggu Depan →
            </Link>
          </div>
        ) : null}
      </div>

      {!result.ok ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {result.error}
        </p>
      ) : (
        <>
          {/* ── Penukar tab (keadaan disimpan dalam URL) ─────────────── */}
          <nav
            className="inline-flex w-full gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto"
            aria-label="Paparan pemantauan"
          >
            {TAB_OPTIONS.map((option) => {
              const active = option.value === activeTab;
              return (
                <Link
                  key={option.value}
                  href={buildHref(option.value, weekMonday)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-touch flex-1 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:flex-none ${
                    active
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>

          {activeTab === 'audit' ? (
            <AssessmentAuditTrail
              rows={result.data.audit}
              cronRuns={result.data.cronRuns}
              actorNames={result.data.actorNames}
              studentNames={studentNames}
            />
          ) : (
            <>
              <MissingLogAlert
                entries={result.data.missing}
                students={result.data.students}
                weekMonday={result.data.week.startDate}
                weekLabel={formatWeekRange(result.data.week)}
                defaultSelectedIds={result.data.missing.map((entry) => entry.student_id)}
              />
              <LogComplianceMatrix
                groups={result.data.classGroups}
                days={result.data.week.days}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
