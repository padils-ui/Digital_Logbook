import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Log Masuk',
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Digital Logbook PAPN
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Sistem Logbook Digital Pusat Anak PERMATA Negara
          </p>
        </div>
        <LoginForm redirectTo={searchParams.redirectTo ?? ''} />
      </div>
    </main>
  );
}
