import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ClassManager } from '@/components/admin/class-manager';
import type { ClassRow, ClassTeacherRow, TeacherOption } from '@/lib/types';

export const metadata: Metadata = { title: 'Pengurusan Kelas' };

export default async function AdminClassesPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin_papn' && profile.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const tenantId = profile.tenant_id;
  const admin = createAdminClient();

  const [classesRes, studentsRes, teachersRes, assignmentsRes] =
    await Promise.all([
      admin
        .from('classes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('class_name'),
      admin.from('students').select('class_id').eq('tenant_id', tenantId),
      admin
        .from('users')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .in('role', ['teacher', 'admin_papn'])
        .order('full_name'),
      admin
        .from('class_teachers')
        .select('id, tenant_id, class_id, teacher_id, created_at')
        .eq('tenant_id', tenantId),
    ]);

  const classes = (classesRes.data ?? []) as ClassRow[];

  const studentCounts: Record<string, number> = {};
  (studentsRes.data ?? []).forEach((s: { class_id: string | null }) => {
    if (s.class_id) studentCounts[s.class_id] = (studentCounts[s.class_id] ?? 0) + 1;
  });

  const teachers = (teachersRes.data ?? []) as TeacherOption[];

  const teacherIdsByClass: Record<string, string[]> = {};
  ((assignmentsRes.data ?? []) as ClassTeacherRow[]).forEach((a) => {
    if (!teacherIdsByClass[a.class_id]) teacherIdsByClass[a.class_id] = [];
    teacherIdsByClass[a.class_id].push(a.teacher_id);
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Pengurusan Kelas</h1>
        <p className="mt-1 text-sm text-slate-600">Urus kelas dan kumpulan umur anak di pusat anda.</p>
      </header>
      <ClassManager
        classes={classes}
        studentCounts={studentCounts}
        teachers={teachers}
        teacherIdsByClass={teacherIdsByClass}
      />
    </div>
  );
}
