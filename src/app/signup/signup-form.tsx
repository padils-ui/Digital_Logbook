'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Building2,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  UserRound,
  Users,
  UserPlus,
} from 'lucide-react';
import type { CenterOption, UserRole } from '@/lib/types';
import { registerAction } from './actions';

const ROLES: {
  value: Extract<UserRole, 'parent' | 'teacher'>;
  label: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    value: 'parent',
    label: 'Ibu Bapa / Penjaga',
    description: 'Lihat rekod anak anda',
    icon: Users,
  },
  {
    value: 'teacher',
    label: 'Pendidik / Pengasuh',
    description: 'Rekod log harian dan insiden',
    icon: GraduationCap,
  },
];

export function SignupForm({ centers }: { centers: CenterOption[] }) {
  const [role, setRole] = useState<'parent' | 'teacher'>('parent');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await registerAction(new FormData(e.currentTarget));

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.redirectTo) {
        // Navigasi penuh supaya cookies baharu (sesi Supabase + papn_status)
        // dihantar ke middleware pada permintaan seterusnya.
        window.location.href = result.redirectTo;
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
          Daftar Sebagai
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
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
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300 dark:border-brand-500 dark:bg-brand-950/50 dark:ring-brand-800'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    active
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {item.label}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="role" value={role} />
      </fieldset>

      <div className="space-y-1">
        <label
          htmlFor="full_name"
          className="text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Nama Penuh
        </label>
        <div className="relative">
          <UserRound
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-hidden
          />
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            required
            placeholder="Nama penuh seperti dalam kad pengenalan"
            className="input pl-9"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="email"
          className="text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          E-mel
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-hidden
          />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="nama@contoh.com"
            className="input pl-9"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Sekurang-kurangnya 8 aksara"
              className="input pl-9"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="confirm_password"
            className="text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Sahkan Kata Laluan
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              aria-hidden
            />
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Ulang kata laluan"
              className="input pl-9"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="tenant_id"
          className="text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Pusat PAPN
        </label>
        <div className="relative">
          <Building2
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-hidden
          />
          <select
            id="tenant_id"
            name="tenant_id"
            required
            defaultValue=""
            className="input pl-9"
            disabled={centers.length === 0}
          >
            <option value="" disabled>
              Pilih pusat PAPN anda
            </option>
            {centers.map((center) => (
              <option key={center.id} value={center.id}>
                {center.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="access_code"
          className="text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Kod Akses Pusat
        </label>
        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-hidden
          />
          <input
            id="access_code"
            name="access_code"
            type="text"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="Kod yang diberikan oleh pentadbir PAPN"
            className="input pl-9 uppercase"
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Dapatkan kod ini daripada pentadbir pusat PAPN anda.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || centers.length === 0}
        className="btn-primary w-full"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Memproses…
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" aria-hidden />
            Daftar Akaun
          </>
        )}
      </button>
    </form>
  );
}
