'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Link2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  ParentRow,
  ParentStudentMapRow,
  StudentOption,
} from '@/lib/types';
import { ParentModal } from './parent-modal';
import { ChildLinkage } from './child-linkage';
import {
  createParent,
  deleteParent,
  updateParent,
  type ParentInput,
} from '@/app/(dashboard)/admin/ibu-bapa/actions';

interface ParentTableProps {
  parents: ParentRow[];
  students: StudentOption[];
  classNames: Record<string, string>;
  links: ParentStudentMapRow[];
}

/** Jadual pengurusan ibu bapa dengan carian, penapis, CRUD dan pautan anak. */
export function ParentTable({
  parents,
  students,
  classNames,
  links,
}: ParentTableProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [linkFilter, setLinkFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ParentRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [linkTarget, setLinkTarget] = useState<ParentRow | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ParentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parents.filter((row) => {
      if (statusFilter === 'active' && !row.is_active) return false;
      if (statusFilter === 'inactive' && row.is_active) return false;
      if (linkFilter === 'linked' && row.linked_count === 0) return false;
      if (linkFilter === 'unlinked' && row.linked_count > 0) return false;
      if (linkFilter === 'primary' && !row.is_primary) return false;
      if (!q) return true;
      return (
        row.full_name.toLowerCase().includes(q) ||
        (row.email ?? '').toLowerCase().includes(q) ||
        (row.phone_number ?? '').toLowerCase().includes(q)
      );
    });
  }, [parents, query, statusFilter, linkFilter]);

  function openAdd() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(row: ParentRow) {
    setEditing(row);
    setFormError(null);
    setModalOpen(true);
  }

  function handleSubmit(input: ParentInput) {
    setSaving(true);
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateParent(editing.id, input)
        : await createParent(input);
      setSaving(false);
      if (!result.ok) {
        setFormError(result.error ?? 'Ralat tidak diketahui.');
        return;
      }
      setModalOpen(false);
      setEditing(null);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    startTransition(async () => {
      const result = await deleteParent(deleteTarget.id);
      setDeleting(false);
      if (!result.ok) {
        setActionError(result.error ?? 'Ralat tidak diketahui.');
        return;
      }
      setDeleteTarget(null);
    });
  }

  return (
    <section className="space-y-4">
      {/* Kiraan jumlah ibu bapa */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge-slate">
          <Users className="mr-1 h-3.5 w-3.5" aria-hidden />
          {parents.length} ibu bapa berdaftar
        </span>
        {filtered.length !== parents.length && (
          <span className="badge-slate">{filtered.length} dipaparkan</span>
        )}
      </div>

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      {/* Carian & penapis */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, e-mel atau telefon…"
            aria-label="Cari ibu bapa"
            className="input pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Tapis mengikut status"
          className="input sm:w-44"
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Tidak Aktif</option>
        </select>
        <select
          value={linkFilter}
          onChange={(e) => setLinkFilter(e.target.value)}
          aria-label="Tapis mengikut pautan anak"
          className="input sm:w-52"
        >
          <option value="all">Semua Pautan</option>
          <option value="linked">Sudah Dipautkan</option>
          <option value="unlinked">Belum Dipautkan</option>
          <option value="primary">Penjaga Utama</option>
        </select>
        <button type="button" onClick={openAdd} className="btn shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          Tambah Ibu Bapa
        </button>
      </div>

      {/* Jadual */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto touch-pan-x">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Nama Ibu Bapa
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Hubungan
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Anak Dipautkan
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Tindakan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Tiada ibu bapa sepadan dengan carian anda.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {row.full_name}
                      </p>
                      <p className="text-xs text-slate-500">{row.email || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">
                        {row.phone_number || '—'}
                      </p>
                      <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Ibu Bapa / Penjaga
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={
                            row.linked_count > 0 ? 'badge-emerald' : 'badge-slate'
                          }
                        >
                          {row.linked_count} anak
                        </span>
                        {row.is_primary && (
                          <span className="badge-slate">
                            <ShieldCheck
                              className="mr-1 h-3.5 w-3.5"
                              aria-hidden
                            />
                            Penjaga Utama
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={row.is_active ? 'badge-emerald' : 'badge-red'}
                      >
                        {row.is_active ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setLinkTarget(row);
                          }}
                          className="btn-ghost px-2"
                          aria-label={`Urus pautan anak bagi ${row.full_name}`}
                        >
                          <Link2 className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="btn-ghost px-2"
                          aria-label={`Sunting ${row.full_name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setDeleteTarget(row);
                          }}
                          className="btn-ghost px-2 text-red-600 hover:bg-red-50"
                          aria-label={`Padam ${row.full_name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal tambah / sunting */}
      <ParentModal
        open={modalOpen}
        parent={editing}
        saving={saving}
        error={formError}
        onClose={() => {
          if (saving) return;
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      {/* Widget pautan anak */}
      <ChildLinkage
        open={linkTarget !== null}
        parent={linkTarget}
        students={students}
        classNames={classNames}
        links={links}
        onClose={() => setLinkTarget(null)}
      />

      {/* Dialog pengesahan padam */}
      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => {
              if (!deleting) setDeleteTarget(null);
            }}
            aria-hidden
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-parent-dialog-title"
            className="relative z-10 max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl"
          >
            <h2
              id="delete-parent-dialog-title"
              className="text-base font-bold text-slate-900"
            >
              Padam Ibu Bapa?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Adakah anda pasti mahu memadam{' '}
              <span className="font-semibold text-slate-800">
                {deleteTarget.full_name}
              </span>
              ? Akaun log masuk dan pautan anak turut dipadam.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn bg-slate-100 text-slate-700 hover:bg-slate-200"
                disabled={deleting}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn bg-red-600 text-white hover:bg-red-700"
                disabled={deleting}
              >
                {deleting ? 'Memadam…' : 'Padam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
