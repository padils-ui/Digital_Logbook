'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  CircleSlash,
  Inbox,
  Link2,
  Loader2,
  UserRound,
} from 'lucide-react';
import type { PendingApprovalRow, StudentOption } from '@/lib/types';
import { formatDateTimeMy } from '@/lib/week-window';
import {
  approveRegistration,
  rejectRegistration,
} from '@/app/(dashboard)/admin/approvals/actions';

interface ApprovalTableProps {
  approvals: PendingApprovalRow[];
  students: StudentOption[];
}

const ROLE_LABEL: Record<string, string> = {
  parent: 'Ibu Bapa',
  teacher: 'Pendidik',
};

/** Jadual baris gilir kelulusan pendaftaran akaun baharu. */
export function ApprovalTable({ approvals, students }: ApprovalTableProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  /** Anak terpilih bagi setiap ibu bapa: { [userId]: studentId[] } */
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [openChildId, setOpenChildId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function toggleChild(userId: string, studentId: string) {
    setSelected((prev) => {
      const current = prev[userId] ?? [];
      const next = current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId];
      return { ...prev, [userId]: next };
    });
  }

  function handleApprove(row: PendingApprovalRow) {
    setBusyId(row.id);
    setActionError(null);
    startTransition(async () => {
      const result = await approveRegistration(row.id, selected[row.id] ?? []);
      setBusyId(null);
      if (!result.ok) {
        setActionError(result.error ?? 'Ralat tidak diketahui.');
        return;
      }
      setOpenChildId(null);
      router.refresh();
    });
  }

  function handleReject(userId: string) {
    setBusyId(userId);
    setActionError(null);
    startTransition(async () => {
      const result = await rejectRegistration(userId);
      setBusyId(null);
      setConfirmRejectId(null);
      if (!result.ok) {
        setActionError(result.error ?? 'Ralat tidak diketahui.');
        return;
      }
      router.refresh();
    });
  }

  if (approvals.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 py-12 text-center">
        <Inbox
          className="h-8 w-8 text-slate-400 dark:text-slate-500"
          aria-hidden
        />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Tiada pendaftaran menunggu kelulusan
        </p>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Permohonan pendaftaran baharu akan dipaparkan di sini untuk semakan
          anda.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <UserRound className="mr-1 h-3.5 w-3.5" aria-hidden />
          {approvals.length} pendaftaran menunggu
        </span>
      </div>

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {actionError}
        </p>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto touch-pan-x">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Nama Penuh
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  E-mel
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Peranan
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Pusat PAPN
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Tarikh Daftar
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Tindakan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {approvals.map((row) => {
                const isParent = row.role === 'parent';
                const chosen = selected[row.id] ?? [];
                const isBusy = busyId === row.id;
                const childPanelOpen = openChildId === row.id;

                return (
                  <tr
                    key={row.id}
                    className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.full_name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {row.email || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          isParent ? 'badge-slate' : 'badge-emerald'
                        }
                      >
                        {ROLE_LABEL[row.role] ?? row.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {row.center_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {formatDateTimeMy(row.created_at).split(',')[0]}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-2">
                        {isParent ? (
                          <div className="flex w-full max-w-xs flex-col items-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenChildId(
                                  childPanelOpen ? null : row.id
                                )
                              }
                              aria-expanded={childPanelOpen}
                              aria-controls={`child-panel-${row.id}`}
                              className="btn-ghost min-h-touch justify-end px-2 text-xs"
                            >
                              <Link2 className="h-4 w-4" aria-hidden />
                              {chosen.length > 0
                                ? `${chosen.length} anak dipilih`
                                : 'Pilih Anak'}
                            </button>

                            {childPanelOpen && (
                              <div
                                id={`child-panel-${row.id}`}
                                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-left shadow-sm dark:border-slate-700 dark:bg-slate-900"
                              >
                                <p className="px-2 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                  Pautkan anak (pilihan)
                                </p>
                                {students.length === 0 ? (
                                  <p className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
                                    Tiada anak berdaftar di pusat ini.
                                  </p>
                                ) : (
                                  <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                                    {students.map((student) => (
                                      <li key={student.id}>
                                        <label className="flex min-h-touch cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                                          <input
                                            type="checkbox"
                                            checked={chosen.includes(student.id)}
                                            onChange={() =>
                                              toggleChild(row.id, student.id)
                                            }
                                            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                          />
                                          <span className="min-w-0 truncate">
                                            {student.full_name}
                                          </span>
                                        </label>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        ) : null}

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {confirmRejectId === row.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleReject(row.id)}
                                disabled={isBusy}
                                className="btn min-h-touch border border-red-300 bg-red-600 px-3 text-white hover:bg-red-700 disabled:opacity-60 dark:border-red-800"
                              >
                                {isBusy ? (
                                  <Loader2
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden
                                  />
                                ) : (
                                  <CircleSlash
                                    className="h-4 w-4"
                                    aria-hidden
                                  />
                                )}
                                Sahkan Tolak
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRejectId(null)}
                                disabled={isBusy}
                                className="btn-ghost min-h-touch px-3 text-xs"
                              >
                                Batal
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(row)}
                                disabled={isBusy}
                                className="btn-primary min-h-touch px-3"
                              >
                                {isBusy ? (
                                  <Loader2
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden
                                  />
                                ) : (
                                  <Check className="h-4 w-4" aria-hidden />
                                )}
                                Luluskan
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRejectId(row.id)}
                                disabled={isBusy}
                                className="btn min-h-touch border border-red-200 px-3 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                              >
                                <CircleSlash className="h-4 w-4" aria-hidden />
                                Tolak
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
