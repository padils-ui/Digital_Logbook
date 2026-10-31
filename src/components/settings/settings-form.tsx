'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Languages, ShieldCheck, UserRound } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

/** Kunci storan setempat bagi keutamaan paparan pengguna. */
const STORAGE_KEY = 'permatlog.preferences';

type Language = 'ms' | 'en-US';
type SessionTimeout = '15' | '30' | '60' | 'never';

interface UserPreferences {
  language: Language;
  emergencyAlerts: boolean;
  dailySummaryEmail: boolean;
  sessionTimeout: SessionTimeout;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'ms',
  emergencyAlerts: true,
  dailySummaryEmail: true,
  sessionTimeout: '30',
};

function isLanguage(value: unknown): value is Language {
  return value === 'ms' || value === 'en-US';
}

function isSessionTimeout(value: unknown): value is SessionTimeout {
  return value === '15' || value === '30' || value === '60' || value === 'never';
}

/** Baca keutamaan tersimpan dengan pengesahan bentuk data. */
function readPreferences(): UserPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFERENCES;
    const data = parsed as Partial<UserPreferences>;
    return {
      language: isLanguage(data.language) ? data.language : DEFAULT_PREFERENCES.language,
      emergencyAlerts:
        typeof data.emergencyAlerts === 'boolean'
          ? data.emergencyAlerts
          : DEFAULT_PREFERENCES.emergencyAlerts,
      dailySummaryEmail:
        typeof data.dailySummaryEmail === 'boolean'
          ? data.dailySummaryEmail
          : DEFAULT_PREFERENCES.dailySummaryEmail,
      sessionTimeout: isSessionTimeout(data.sessionTimeout)
        ? data.sessionTimeout
        : DEFAULT_PREFERENCES.sessionTimeout,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

interface SettingsFormProps {
  /** Nama penuh pengguna yang sedang log masuk. */
  fullName: string;
}

/** Borang keutamaan peribadi: tema, bahasa, pemberitahuan dan sesi peranti. */
export function SettingsForm({ fullName }: SettingsFormProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState(false);

  // Baca storan setempat selepas penghidratan untuk mengelakkan ketidakpadanan SSR.
  useEffect(() => {
    setPreferences(readPreferences());
  }, []);

  // Sembunyikan sepanduk kejayaan selepas tiga saat.
  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  function handleSave() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <header className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Tema &amp; Paparan
          </h2>
        </header>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Pilih tema paparan. Pilihan Sistem akan mengikut tetapan peranti anda.
        </p>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </section>

      <section className="card p-5">
        <header className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Bahasa &amp; Wilayah
          </h2>
        </header>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Bahasa antara muka lalai ialah Bahasa Melayu.
        </p>
        <div className="mt-4 max-w-sm">
          <label htmlFor="settings-language" className="label dark:text-slate-300">
            Bahasa
          </label>
          <select
            id="settings-language"
            value={preferences.language}
            onChange={(event) =>
              setPreferences((prev) => ({
                ...prev,
                language: event.target.value as Language,
              }))
            }
            className="input dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="ms">Bahasa Melayu (Lalai)</option>
            <option value="en-US">English (US)</option>
          </select>
        </div>
      </section>

      <section className="card p-5">
        <header className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Pemberitahuan &amp; Emel
          </h2>
        </header>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tetapkan pemberitahuan yang ingin anda terima.
        </p>
        <div className="mt-4 space-y-2">
          <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
            <input
              type="checkbox"
              checked={preferences.emergencyAlerts}
              onChange={(event) =>
                setPreferences((prev) => ({
                  ...prev,
                  emergencyAlerts: event.target.checked,
                }))
              }
              className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-200">
              Pemberitahuan insiden kecemasan
            </span>
          </label>
          <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
            <input
              type="checkbox"
              checked={preferences.dailySummaryEmail}
              onChange={(event) =>
                setPreferences((prev) => ({
                  ...prev,
                  dailySummaryEmail: event.target.checked,
                }))
              }
              className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-200">
              Emel ringkasan log harian
            </span>
          </label>
        </div>
      </section>

      <section className="card p-5">
        <header className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Keselamatan Tablet Peranti Sesi
          </h2>
        </header>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Log keluar automatik apabila tablet dibiarkan tanpa aktiviti.
        </p>
        <div className="mt-4 max-w-sm">
          <label htmlFor="settings-timeout" className="label dark:text-slate-300">
            Had masa tidak aktif
          </label>
          <select
            id="settings-timeout"
            value={preferences.sessionTimeout}
            onChange={(event) =>
              setPreferences((prev) => ({
                ...prev,
                sessionTimeout: event.target.value as SessionTimeout,
              }))
            }
            className="input dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="15">15 minit</option>
            <option value="30">30 minit</option>
            <option value="60">1 jam</option>
            <option value="never">Tidak pernah</option>
          </select>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Keutamaan disimpan pada peranti ini untuk akaun {fullName}.
        </p>
        <button type="button" onClick={handleSave} className="btn-primary w-full sm:w-auto">
          Simpan Tetapan
        </button>
      </div>

      {saved ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Tetapan berjaya disimpan.
        </div>
      ) : null}
    </div>
  );
}
