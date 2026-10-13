import type { Metadata } from 'next';
import { CalendarDays, ClipboardList, TriangleAlert } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { StudentGrid } from '@/components/teacher/student-grid';
import { LogEntryForm } from '@/components/teacher/log-entry-form';
import type { EmergencyContact } from '@/components/teacher/student-card';
import type { ClassRow, Student } from '@/lib/types';

export const metadata: Metadata = { title: 'Ruang Pendidik' };

export default async function TeacherPage() {
  const profile = await getCurrentUser();
  const tenantId = profile?.tenant_id ?? '';

  // Klien admin (service role) untuk bacaan selamat — memintas rekursi RLS
  // pada jadual `users`. Setiap pertanyaan ditapis mengikut tenant_id.
  const admin = createAdminClient();

  const today = new Date().toISOString().slice(0, 10);

  const [studentsRes, classesRes, todayLogs, incidents] = await Promise.all([
    admin
      .from('students')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('full_name'),
    admin
      .from('classes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('class_name'),
    admin
      .from('daily_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('log_date', today),
    admin
      .from('incident_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('acknowledged_by_parent', false),
  ]);

  const students = (studentsRes.data ?? []) as Student[];
  const classes = (classesRes.data ?? []) as ClassRow[];

  const classNames: Record<string, string> = {};
  classes.forEach((c) => {
    classNames[c.id] = c.class_name;
  });

  // Hubungan kecemasan untuk semua anak yang dipaparkan (jika jadual wujud).
  const contactsByStudent: Record<string, EmergencyContact[]> = {};
  if (students.length) {
    const { data: contacts } = await admin
      .from('student_emergency_contacts')
      .select('*')
      .in(
        'student_id',
        students.map((s) => s.id)
      );

    (contacts ?? []).forEach((contact) => {
      const row = contact as EmergencyContact;
      if (!contactsByStudent[row.student_id]) {
        contactsByStudent[row.student_id] = [];
      }
      contactsByStudent[row.student_id].push(row);
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Ruang Pendidik / Pengasuh
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Selamat datang, {profile?.full_name ?? 'Pendidik'}.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <CalendarDays className="h-5 w-5 text-brand-600" aria-hidden />
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {todayLogs.count ?? 0}
          </p>
          <p className="text-xs text-slate-500">Log direkod hari ini</p>
        </div>
        <div className="card">
          <TriangleAlert className="h-5 w-5 text-amber-600" aria-hidden />
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {incidents.count ?? 0}
          </p>
          <p className="text-xs text-slate-500">Insiden belum diakui</p>
        </div>
        <div className="card">
          <ClipboardList className="h-5 w-5 text-emerald-600" aria-hidden />
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {students.length}
          </p>
          <p className="text-xs text-slate-500">Anak berdaftar</p>
        </div>
      </section>

      <LogEntryForm students={students} classNames={classNames} />

      <StudentGrid
        students={students}
        classNames={classNames}
        contactsByStudent={contactsByStudent}
      />
    </div>
  );
}
