import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AttendanceManager } from '@/components/teacher/attendance-manager';
import type { ClassRow, Student } from '@/lib/types';

export const metadata: Metadata = { title: 'Kehadiran Anak' };

interface AttendanceQueryRow {
  student_id: string;
  status: string | null;
  suhu_tiba: string | null;
  suhu_balik: string | null;
  catatan: string | null;
}

/** Sahkan format tarikh ISO (YYYY-MM-DD). */
function normalizeDateParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) return raw;
  }
  return new Date().toISOString().slice(0, 10);
}

export default async function KehadiranPage({
  searchParams,
}: {
  searchParams?: { date?: string | string[] };
}) {
  const profile = await getCurrentUser();
  const tenantId = profile?.tenant_id ?? '';
  const date = normalizeDateParam(searchParams?.date);

  // Klien admin (service role) untuk bacaan selamat — memintas rekursi RLS
  // pada jadual `users`. Setiap pertanyaan ditapis mengikut tenant_id.
  const admin = createAdminClient();

  const [studentsRes, classesRes, attendanceRes] = await Promise.all([
    admin.from('students').select('*').eq('tenant_id', tenantId).order('full_name'),
    admin.from('classes').select('*').eq('tenant_id', tenantId).order('class_name'),
    admin
      .from('attendance')
      .select('student_id, status, suhu_tiba, suhu_balik, catatan')
      .eq('tenant_id', tenantId)
      .eq('date', date),
  ]);

  const students = (studentsRes.data ?? []) as Student[];
  const classes = (classesRes.data ?? []) as ClassRow[];

  const classNames: Record<string, string> = {};
  classes.forEach((c) => {
    classNames[c.id] = c.class_name;
  });

  const initialRecords: Record<
    string,
    {
      status: string | null;
      suhu_tiba: string | null;
      suhu_balik: string | null;
      catatan: string | null;
    }
  > = {};
  (attendanceRes.data ?? []).forEach((row) => {
    const r = row as AttendanceQueryRow;
    initialRecords[r.student_id] = {
      status: r.status,
      suhu_tiba: r.suhu_tiba,
      suhu_balik: r.suhu_balik,
      catatan: r.catatan,
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Kehadiran &amp; Suhu Anak
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Rekod kehadiran harian, suhu tiba dan suhu pulang bagi setiap anak.
        </p>
      </header>

      <AttendanceManager
        key={date}
        students={students}
        classNames={classNames}
        date={date}
        initialRecords={initialRecords}
      />
    </div>
  );
}
