import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ClassManager } from '@/components/admin/class-manager';
import type { ClassRow } from '@/lib/types';

export const metadata: Metadata = { title: 'Pengurusan Kelas' };

export default async function AdminClassesPage() {
  const profile = await getCurrentUser();
  const tenantId = profile?.tenant_id ?? '';

  // Klien admin memintas RLS — setiap pertanyaan tetap ditapis tenant_id.
  const admin = createAdminClient();
  const [classesRes, studentsRes] = await Promise.all([
    admin
      .from('classes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('class_name'),
    admin.from('students').select('class_id').eq('tenant_id', tenantId),
  ]);

  const classes = (classesRes.data ?? []) as ClassRow[];

  // Kira bilangan anak bagi setiap kelas.
  const studentCounts: Record<string, number> = {};
  (studentsRes.data ?? []).forEach((s: { class_id: string | null }) => {
    if (s.class_id) {
      studentCounts[s.class_id] = (studentCounts[s.class_id] ?? 0) + 1;
    }
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Pengurusan Kelas
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Urus kelas dan kumpulan umur anak di pusat anda.
        </p>
      </header>

      <ClassManager classes={classes} studentCounts={studentCounts} />
    </div>
  );
}
