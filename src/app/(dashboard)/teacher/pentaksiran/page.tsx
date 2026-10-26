import type { Metadata } from 'next';
import { Inbox } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AssessmentReviewCard,
  type ReviewReport,
} from '@/components/pentaksiran/assessment-review-card';
import {
  PERMATA_DOMAINS,
  RedFlagSchema,
  type PermataDomain,
  type RedFlag,
} from '@/lib/validations/assessment';

export const metadata: Metadata = { title: 'Laporan Pentaksiran' };

interface AssessmentRow {
  id: string;
  student_id: string;
  week_number: number;
  year: number;
  start_date: string;
  end_date: string;
  domain_scores: unknown;
  summary: string | null;
  teacher_notes: string | null;
  suggestions_next_week: unknown;
  red_flags: unknown;
}

interface StudentRow {
  id: string;
  full_name: string;
  class_id: string | null;
}

interface ClassOption {
  id: string;
  class_name: string;
}

/** Format tarikh ISO (YYYY-MM-DD) ke paparan Bahasa Melayu. */
function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ms-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Normalkan skor domain daripada JSONB. */
function normalizeDomainScores(
  raw: unknown
): Partial<Record<PermataDomain, number | null>> {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const scores: Partial<Record<PermataDomain, number | null>> = {};

  for (const domain of PERMATA_DOMAINS) {
    const value = source[domain];
    scores[domain] =
      typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  return scores;
}

/** Sahkan bendera merah daripada JSONB. */
function normalizeRedFlags(raw: unknown): RedFlag[] {
  const parsed = RedFlagSchema.array().safeParse(raw ?? []);
  return parsed.success ? parsed.data : [];
}

/** Sahkan cadangan minggu hadapan. */
function normalizeSuggestions(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string')
    : [];
}

export default async function PentaksiranPage() {
  const profile = await getCurrentUser();
  const tenantId = profile?.tenant_id ?? '';

  // Klien admin (service role) memintas RLS — setiap pertanyaan ditapis
  // mengikut tenant_id pengguna yang disahkan.
  const admin = createAdminClient();

  const [reportsRes, studentsRes, classesRes] = await Promise.all([
    admin
      .from('assessment_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'DRAFT')
      .order('year', { ascending: false })
      .order('week_number', { ascending: false })
      .order('created_at', { ascending: false }),
    admin
      .from('students')
      .select('id, full_name, class_id')
      .eq('tenant_id', tenantId),
    admin
      .from('classes')
      .select('id, class_name')
      .eq('tenant_id', tenantId),
  ]);

  if (reportsRes.error) {
    console.error(
      '[PentaksiranPage] Gagal memuatkan laporan draf:',
      reportsRes.error
    );
  }

  const students = (studentsRes.data ?? []) as StudentRow[];
  const classes = (classesRes.data ?? []) as ClassOption[];

  const studentMap = new Map(students.map((student) => [student.id, student]));
  const classMap = new Map(classes.map((item) => [item.id, item.class_name]));

  const reports: ReviewReport[] = ((reportsRes.data ?? []) as AssessmentRow[]).map(
    (row) => {
      const student = studentMap.get(row.student_id);
      return {
        id: row.id,
        studentName: student?.full_name ?? 'Anak Tanpa Nama',
        className: (student?.class_id && classMap.get(student.class_id)) || 'Tanpa Kelas',
        weekNumber: row.week_number,
        year: row.year,
        periodLabel: `${formatDate(row.start_date)} – ${formatDate(row.end_date)}`,
        domainScores: normalizeDomainScores(row.domain_scores),
        summary: row.summary ?? '',
        teacherNotes: row.teacher_notes ?? '',
        suggestionsNextWeek: normalizeSuggestions(row.suggestions_next_week),
        redFlags: normalizeRedFlags(row.red_flags),
      };
    }
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Semakan Laporan Pentaksiran
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Semak draf laporan bulanan PERMATA, sunting ringkasan dan catatan guru,
          kemudian terbitkan untuk ibu bapa.
        </p>
      </header>

      <p className="text-xs font-medium text-slate-500">
        {reports.length} laporan draf menunggu semakan
      </p>

      {reports.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-10 text-center">
          <Inbox className="h-8 w-8 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-700">
            Tiada laporan draf buat masa ini.
          </p>
          <p className="text-xs text-slate-500">
            Laporan baharu akan muncul di sini selepas pemprosesan AI selesai.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {reports.map((report) => (
            <AssessmentReviewCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
