import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApprovalTable } from '@/components/admin/approval-table';
import type { PendingApprovalRow, StudentOption } from '@/lib/types';

export const metadata: Metadata = { title: 'Kelulusan Pendaftaran' };

export default async function AdminApprovalsPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin_papn' && profile.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const tenantId = profile.tenant_id;

  // Klien admin memintas RLS — setiap pertanyaan tetap ditapis tenant_id.
  const admin = createAdminClient();
  const [pendingRes, studentsRes, settingsRes, tenantRes] = await Promise.all([
    admin
      .from('users')
      .select('id, full_name, email, role, tenant_id, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    admin
      .from('students')
      .select('id, full_name, nickname, mykid_number, class_id')
      .eq('tenant_id', tenantId)
      .order('full_name'),
    admin
      .from('center_settings')
      .select('center_name')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle(),
  ]);

  // Nama pusat sebenar sahaja: center_settings.center_name, kemudian
  // tenants.name. app_name / tajuk aplikasi tidak digunakan.
  const centerName =
    settingsRes.data?.center_name?.trim() ||
    tenantRes.data?.name?.trim() ||
    'Pusat PAPN';

  const rows = (pendingRes.data ?? []) as Omit<PendingApprovalRow, 'center_name'>[];
  const approvals: PendingApprovalRow[] = rows.map((row) => ({
    ...row,
    center_name: centerName,
  }));
  const students = (studentsRes.data ?? []) as StudentOption[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
          Kelulusan Pendaftaran
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Semak permohonan pendaftaran sendiri sebelum memberi akses kepada
          pusat anda.
        </p>
      </header>

      <ApprovalTable approvals={approvals} students={students} />
    </div>
  );
}
