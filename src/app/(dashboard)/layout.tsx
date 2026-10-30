import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import type { UserRole } from '@/lib/types';

/**
 * Susun atur papan pemuka berkongsi: mengesahkan sesi, memuatkan profil
 * dan nama pusat (tenant), kemudian membalut kandungan dengan AppShell.
 *
 * Susun atur ini berjalan pada Node runtime, jadi ia boleh mengakses
 * service role key dan merupakan tempat pengesahan peranan yang berwibawa.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');

  const supabase = createClient();
  const [tenantRes, settingsRes] = await Promise.all([
    supabase
      .from('tenants')
      .select('name, app_name')
      .eq('id', profile.tenant_id)
      .maybeSingle(),
    supabase
      .from('center_settings')
      .select('logo_url')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle(),
  ]);

  const tenant = tenantRes.data;

  return (
    <AppShell
      role={profile.role as UserRole}
      fullName={profile.full_name}
      tenantName={tenant?.app_name || tenant?.name || 'PAPN'}
      logoUrl={settingsRes.data?.logo_url ?? null}
    >
      {children}
    </AppShell>
  );
}
