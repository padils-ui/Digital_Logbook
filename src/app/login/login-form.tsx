'use client';

import { useState } from 'react';
import {
  AlertCircle,
  GraduationCap,
  Loader2,
  Lock,
  Phone,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import type { UserRole } from '@/lib/types';

const ROLES: {
  value: UserRole;
  label: string;
  description: string;
  icon: typeof ShieldCheck;
}[] = [
  {
    value: 'admin_papn',
    label: 'Pentadbir PAPN',
    description: 'Urus pusat, kelas dan pengguna',
    icon: ShieldCheck,
  },
  {
    value: 'teacher',
    label: 'Pendidik / Pengasuh',
    description: 'Rekod log harian dan insiden',
    icon: GraduationCap,
  },
  {
    value: 'parent',
    label: 'Ibu Bapa / Penjaga',
    description: 'Lihat rekod anak anda',
    icon: Users,
  },
];

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [role, setRole] = useState<UserRole>('teacher');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `credentials: 'same-origin'` memastikan pelayar menyimpan
        // cookies daripada Set-Cookie header dalam respons.
        credentials: 'same-origin',
        body: JSON.stringify({ identifier, password, role, redirectTo }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Log masuk gagal. Sila cuba lagi.');
        return;
      }

      // Semua cookies (Supabase session + papn_role) sudah ditetapkan
      // oleh pelayar melalui Set-Cookie header. Navigasi terus ke destinasi.
      if (data.redirectTo) {
        // Navigasi penuh (bukan soft navigation) supaya pelayar menghantar
        // semua cookies baharu (papn_role + Supabase session) terus ke
        // middleware pada permintaan GET /teacher.
        window.location.href = data.redirectTo;
      }
    } catch {
      setError('Ralat rangkaian. Sila periksa sambungan internet anda.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8"
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Pilih Peranan
        </legend>
        <div className="grid gap-2">
          {ROLES.map((item) => {
            const Icon = item.icon;
            const active = role === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setRole(item.value)}
                aria-pressed={active}
                className={`flex min-h-touch items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? 'border-brand-600 bg-brand-600 text-white ring-1 ring-brand-600'
                    : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-900/70'
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    active
                      ? 'text-white'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-semibold ${
                      active ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span
                    className={`block truncate text-xs ${
                      active ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1">
        <label
          htmlFor="identifier"
          className="text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          E-mel atau Nombor Telefon
        </label>
        <div className="relative">
          <Phone
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-hidden
          />
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            required
            placeholder="nama@papn.gov.my atau 0123456789"
            className="min-h-touch w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-brand-900"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="password"
          className="text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Kata Laluan
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-hidden
          />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="min-h-touch w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-brand-900"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Memproses…
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" aria-hidden />
            Log Masuk
          </>
        )}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <UserRound className="h-3.5 w-3.5" aria-hidden />
        Akaun didaftarkan oleh pentadbir PAPN
      </p>
    </form>
  );
}
