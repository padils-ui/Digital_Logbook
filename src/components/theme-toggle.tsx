'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';

type ThemeOption = 'light' | 'dark' | 'system';

const OPTIONS: { value: ThemeOption; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'dark', label: 'Gelap', icon: Moon },
  { value: 'system', label: 'Sistem', icon: Monitor },
];

/**
 * Pemilih tema tiga keadaan (Terang / Gelap / Sistem).
 *
 * Tema sebenar hanya diketahui selepas penghidratan, jadi komponen ini
 * memaparkan pemegang tempat yang sama saiz sehingga `mounted` menjadi benar
 * bagi mengelakkan ketidakpadanan SSR.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        aria-hidden
        data-testid="theme-toggle-placeholder"
      >
        {OPTIONS.map((option) => (
          <div
            key={option.value}
            className="min-h-touch rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Pilih tema paparan"
      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={`flex min-h-touch items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              active
                ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-slate-800 dark:text-brand-200'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
