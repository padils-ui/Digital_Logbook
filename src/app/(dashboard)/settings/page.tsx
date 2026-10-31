import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SettingsForm } from '@/components/settings/settings-form';

export const metadata: Metadata = { title: 'Tetapan' };

export default async function SettingsPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect('/login');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
          Tetapan
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Keutamaan paparan, bahasa, pemberitahuan dan keselamatan sesi peranti.
        </p>
      </header>

      <SettingsForm fullName={profile.full_name} />
    </div>
  );
}
