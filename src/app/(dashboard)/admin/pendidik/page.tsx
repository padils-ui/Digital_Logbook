import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { TeacherTable } from '@/components/admin/teacher-table';
import type { ClassRow, ClassTeacherRow, TeacherRow } from '@/lib/types';

export const metadata: Metadata = { title: 'Pengurusan Pendidik' };

export default async function AdminPendidikPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin_papn' && profile.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const tenantId = profile.tenant_id;

  // Klien admin memintas RLS — setiap pertanyaan tetap ditapis tenant_id.
  const admin = createAdminClient();
  const [teachersRes, classesRes, assignmentsRes] = await Promise.all([
    admin
      .from('users')
      .select('id, full_name, email, phone_number, role, is_active, created_at')
      .eq('tenant_id', tenantId)
      .in('role', ['teacher', 'admin_papn'])
      .order('full_name'),
    admin
      .from('classes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('class_name'),
    admin
      .from('class_teachers')
      .select('id, tenant_id, class_id, teacher_id, created_at')
      .eq('tenant_id', tenantId),
  ]);

  const classes = (classesRes.data ?? []) as ClassRow[];
  const assignments = (assignmentsRes.data ?? []) as ClassTeacherRow[];

  // Peta kelas bagi setiap pendidik.
  const classIdsByTeacher: Record<string, string[]> = {};
  assignments.forEach((a) => {
    if (!classIdsByTeacher[a.teacher_id]) classIdsByTeacher[a.teacher_id] = [];
    classIdsByTeacher[a.teacher_id].push(a.class_id);
  });

  const teacherRows = (teachersRes.data ?? []) as Omit<TeacherRow, 'class_ids'>[];
  const teachers: TeacherRow[] = teacherRows.map((t) => ({
    ...t,
    class_ids: classIdsByTeacher[t.id] ?? [],
  }));

  const classNames: Record<string, string> = {};
  classes.forEach((c) => {
    classNames[c.id] = c.class_name;
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Pengurusan Pendidik
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Urus akaun pendidik dan pengasuh di pusat anda.
        </p>
      </header>

      <TeacherTable
        teachers={teachers}
        classes={classes}
        classNames={classNames}
      />
    </div>
  );
}
