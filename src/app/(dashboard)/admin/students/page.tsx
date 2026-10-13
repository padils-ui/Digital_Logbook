import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { StudentTable } from '@/components/admin/student-table';
import { ensureDefaultClasses } from './actions';
import type { ClassRow, Student } from '@/lib/types';

export const metadata: Metadata = { title: 'Pengurusan Anak & Ibu Bapa' };

export default async function AdminStudentsPage() {
  const profile = await getCurrentUser();
  const tenantId = profile?.tenant_id ?? '';

  // Cipta kelas lalai jika tenant belum ada kelas (elak dropdown kosong).
  if (tenantId) {
    await ensureDefaultClasses(tenantId);
  }

  // Klien admin memintas RLS — elak rekursi dasar pada jadual `users`.
  // Setiap pertanyaan tetap ditapis mengikut tenant_id pengguna.
  const admin = createAdminClient();
  const [studentsRes, classesRes] = await Promise.all([
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
  ]);

  const students = (studentsRes.data ?? []) as Student[];
  const classes = (classesRes.data ?? []) as ClassRow[];

  const classNames: Record<string, string> = {};
  classes.forEach((c) => {
    classNames[c.id] = c.class_name;
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Pengurusan Anak &amp; Ibu Bapa
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Urus pendaftaran anak, kelas dan maklumat penjaga.
        </p>
      </header>

      <StudentTable
        students={students}
        classes={classes}
        classNames={classNames}
      />
    </div>
  );
}
