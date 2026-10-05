import type { Metadata } from 'next';
import { TenantForm } from '@/components/admin/tenant-form';

export const metadata: Metadata = { title: 'Pengurusan Pusat' };

export default function AdminTenantsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Pengurusan Pusat
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Daftarkan pusat (tenant) baharu dan sediakan folder Google Drive
          secara automatik.
        </p>
      </header>

      <TenantForm />
    </div>
  );
}
