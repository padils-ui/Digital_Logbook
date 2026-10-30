import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { CenterSettingsForm } from '@/components/admin/center-settings-form';
import { LetterheadUploader } from '@/components/admin/letterhead-uploader';
import { LogoUploader } from '@/components/admin/logo-uploader';
import { AcademicCalendarManager } from '@/components/admin/academic-calendar-manager';
import type { AcademicCalendarRow, CenterSettings } from '@/lib/types';

export const metadata: Metadata = { title: 'Tetapan PAPN' };

export default async function AdminTetapanPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin_papn' && profile.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const tenantId = profile.tenant_id;

  // Klien admin memintas RLS — setiap pertanyaan tetap ditapis tenant_id.
  const admin = createAdminClient();
  const [settingsRes, calendarRes] = await Promise.all([
    admin
      .from('center_settings')
      .select(
        'id, tenant_id, center_name, code, address, phone, email, academic_year, letterhead_url, logo_url, updated_at'
      )
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin
      .from('academic_calendar')
      .select('id, tenant_id, date, event_name, is_holiday, created_at')
      .eq('tenant_id', tenantId)
      .order('date'),
  ]);

  const settings = (settingsRes.data ?? null) as CenterSettings | null;
  const calendarEntries = (calendarRes.data ?? []) as AcademicCalendarRow[];
  const loadError = settingsRes.error ?? calendarRes.error;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Tetapan PAPN</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tetapan pusat, logo, kepala surat dan takwim akademik.
        </p>
      </header>

      {loadError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          Gagal memuatkan data tetapan: {loadError.message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <CenterSettingsForm settings={settings} />
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <LogoUploader logoUrl={settings?.logo_url ?? null} />
          </section>

          <section className="card p-5">
            <LetterheadUploader letterheadUrl={settings?.letterhead_url ?? null} />
          </section>
        </div>
      </div>

      <AcademicCalendarManager entries={calendarEntries} />
    </div>
  );
}
