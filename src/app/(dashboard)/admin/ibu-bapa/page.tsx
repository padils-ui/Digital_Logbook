import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ParentTable } from '@/components/admin/parent-table';
import type {
  ClassRow,
  ParentRow,
  ParentStudentMapRow,
  StudentOption,
} from '@/lib/types';

export const metadata: Metadata = { title: 'Pengurusan Ibu Bapa' };

export default async function AdminIbuBapaPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin_papn' && profile.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const tenantId = profile.tenant_id;

  // Klien admin memintas RLS — setiap pertanyaan tetap ditapis tenant_id.
  const admin = createAdminClient();
  const [parentsRes, studentsRes, classesRes, linksRes] = await Promise.all([
    admin
      .from('users')
      .select('id, full_name, email, phone_number, is_active, created_at')
      .eq('tenant_id', tenantId)
      .eq('role', 'parent')
      .order('full_name'),
    admin
      .from('students')
      .select('id, full_name, nickname, mykid_number, class_id')
      .eq('tenant_id', tenantId)
      .order('full_name'),
    admin.from('classes').select('*').eq('tenant_id', tenantId).order('class_name'),
    admin
      .from('parent_student_map')
      .select(
        'id, tenant_id, parent_id, student_id, relationship_type, is_primary, created_at, updated_at'
      )
      .eq('tenant_id', tenantId),
  ]);

  const students = (studentsRes.data ?? []) as StudentOption[];
  const classes = (classesRes.data ?? []) as ClassRow[];
  const links = (linksRes.data ?? []) as ParentStudentMapRow[];

  // Kira bilangan anak dan status penjaga utama bagi setiap ibu bapa.
  const linkedCounts: Record<string, number> = {};
  const primaryParents: Record<string, boolean> = {};
  links.forEach((link) => {
    linkedCounts[link.parent_id] = (linkedCounts[link.parent_id] ?? 0) + 1;
    if (link.is_primary) primaryParents[link.parent_id] = true;
  });

  const parentRows = (parentsRes.data ?? []) as Omit<
    ParentRow,
    'linked_count' | 'is_primary'
  >[];
  const parents: ParentRow[] = parentRows.map((row) => ({
    ...row,
    linked_count: linkedCounts[row.id] ?? 0,
    is_primary: primaryParents[row.id] ?? false,
  }));

  const classNames: Record<string, string> = {};
  classes.forEach((c) => {
    classNames[c.id] = c.class_name;
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Pengurusan Ibu Bapa
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Urus pemetaan ibu bapa / penjaga kepada anak di pusat anda.
        </p>
      </header>

      <ParentTable
        parents={parents}
        students={students}
        classNames={classNames}
        links={links}
      />
    </div>
  );
}
