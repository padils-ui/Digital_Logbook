'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  LogOut,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { refreshApprovalStatus } from './actions';
import type { UserApprovalStatus } from '@/lib/types';

/**
 * Butang tindakan pada skrin "Akaun Menunggu Kelulusan":
 * semak semula status kelulusan dan log keluar.
 */
export function PendingApprovalActions({
  initialStatus,
}: {
  initialStatus: UserApprovalStatus;
}) {
  const [status, setStatus] = useState<UserApprovalStatus>(initialStatus);
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCheck() {
    setChecking(true);
    setError(null);
    setNotice(null);

    const result = await refreshApprovalStatus();

    if (result.error) {
      setError(result.error);
      setChecking(false);
      return;
    }

    if (result.status) setStatus(result.status);

    if (result.status === 'approved' && result.redirectTo) {
      // Navigasi penuh supaya cookie papn_status baharu sampai ke middleware.
      window.location.href = result.redirectTo;
      return;
    }

    if (result.status === 'rejected') {
      setNotice('Permohonan anda telah ditolak. Sila hubungi pentadbir PAPN.');
    } else {
      setNotice('Akaun anda masih menunggu kelulusan pentadbir PAPN.');
    }

    setChecking(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Teruskan membersihkan cookie walaupun panggilan rangkaian gagal.
    }

    document.cookie = 'papn_role=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'papn_status=; path=/; max-age=0; SameSite=Lax';
    window.location.href = '/login';
  }

  return (
    <div className="space-y-3">
      {status === 'approved' && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Akaun anda telah diluluskan. Teruskan ke ruang kerja anda.</span>
        </div>
      )}

      {status === 'rejected' && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Permohonan pendaftaran anda telah ditolak. Sila hubungi pentadbir
            PAPN untuk maklumat lanjut.
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {notice && !error && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        >
          {notice}
        </div>
      )}

      <button
        type="button"
        onClick={handleCheck}
        disabled={checking || signingOut}
        className="btn btn-primary w-full"
      >
        {checking ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        )}
        {checking ? 'Menyemak…' : status === 'approved' ? 'Masuk ke Ruang Kerja' : 'Semak Status'}
      </button>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="btn btn-ghost w-full"
      >
        {signingOut ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="h-4 w-4" aria-hidden="true" />
        )}
        {signingOut ? 'Sedang keluar…' : 'Log Keluar'}
      </button>
    </div>
  );
}
