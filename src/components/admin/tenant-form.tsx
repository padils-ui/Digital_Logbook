'use client';

import { useState } from 'react';
import { BadgeCheck, Building2, ExternalLink, Plus, Ticket } from 'lucide-react';

/** Kod baucar khas yang memintas gerbang pembayaran. */
const BYPASS_VOUCHER_CODE = 'PAPN100';

interface ProvisionResult {
  tenant: { id: string; name: string };
  google_drive_folder_id: string;
}

/** Borang pendaftaran tenant baharu + penyediaan folder Google Drive. */
export function TenantForm() {
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [googleDriveEmail, setGoogleDriveEmail] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [studentLimit, setStudentLimit] = useState('50');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionResult | null>(null);

  // Baucar yang telah disahkan melalui butang "Guna Baucar".
  const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  const isBypassVoucher = appliedVoucher?.toUpperCase() === BYPASS_VOUCHER_CODE;

  /** Sahkan kod baucar melalui API sebelum pendaftaran. */
  async function handleApplyVoucher() {
    const code = voucherCode.trim();
    setVoucherError(null);
    setAppliedVoucher(null);

    if (!code) {
      setVoucherError('Sila masukkan kod baucar.');
      return;
    }

    try {
      const res = await fetch('/api/admin/tenants/validate-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucher_code: code }),
      });
      const data = await res.json();
      if (!res.ok || !data?.valid) {
        setVoucherError(data?.error ?? 'Kod baucar tidak sah.');
        return;
      }
      setAppliedVoucher(code);
    } catch {
      setVoucherError('Ralat rangkaian. Sila cuba lagi.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/admin/tenants/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          admin_email: adminEmail,
          google_drive_email: googleDriveEmail,
          voucher_code: voucherCode,
          student_limit: Number(studentLimit),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Gagal mendaftarkan pusat.');
        return;
      }

      setResult(data as ProvisionResult);
      setName('');
      setAdminEmail('');
      setGoogleDriveEmail('');
      setVoucherCode('');
      setAppliedVoucher(null);
      setStudentLimit('50');
    } catch {
      setError('Ralat rangkaian. Sila cuba lagi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-brand-600" aria-hidden />
          <h2 className="text-base font-bold text-slate-900">
            Daftar Pusat Baharu
          </h2>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Nama Pusat
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth. PAPN Taman Sri"
              required
              className="input"
            />
          </div>

          <div>
            <label
              htmlFor="admin_email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Emel Pentadbir
            </label>
            <input
              id="admin_email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@contoh.com"
              required
              className="input"
            />
          </div>

          <div>
            <label
              htmlFor="google_drive_email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Emel Google Drive
            </label>
            <input
              id="google_drive_email"
              type="email"
              value={googleDriveEmail}
              onChange={(e) => setGoogleDriveEmail(e.target.value)}
              placeholder="akaun.drive@gmail.com"
              required
              className="input"
            />
            <p className="mt-1 text-xs text-slate-500">
              Folder Drive akan dikongsi dengan emel ini sebagai penulis.
            </p>
          </div>

          <div>
            <label
              htmlFor="voucher_code"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Kod Voucher
            </label>
            <div className="flex gap-2">
              <input
                id="voucher_code"
                type="text"
                value={voucherCode}
                onChange={(e) => {
                  setVoucherCode(e.target.value);
                  setAppliedVoucher(null);
                  setVoucherError(null);
                }}
                placeholder="cth. PAPN100"
                className="input"
              />
              <button
                type="button"
                onClick={handleApplyVoucher}
                className="btn shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                <Ticket className="h-4 w-4" aria-hidden />
                Guna Baucar
              </button>
            </div>

            {voucherError && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {voucherError}
              </p>
            )}

            {appliedVoucher && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                {isBypassVoucher
                  ? 'Baucar PAPN100 Diaktifkan (Diskaun 100%)'
                  : `Baucar ${appliedVoucher} Diaktifkan`}
              </span>
            )}
          </div>

          <div>
            <label
              htmlFor="student_limit"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Had Anak
            </label>
            <input
              id="student_limit"
              type="number"
              min={1}
              value={studentLimit}
              onChange={(e) => setStudentLimit(e.target.value)}
              required
              className="input"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn" disabled={saving}>
            <Plus className="h-4 w-4" aria-hidden />
            {saving ? 'Menyediakan…' : 'Daftar & Sediakan Drive'}
          </button>
        </div>
      </form>

      {result && (
        <div className="card space-y-2 border-green-200 bg-green-50">
          <p className="text-sm font-semibold text-green-800">
            Pusat &quot;{result.tenant.name}&quot; berjaya didaftarkan.
          </p>
          <a
            href={`https://drive.google.com/drive/folders/${result.google_drive_folder_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 underline"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Buka Folder Google Drive
          </a>
        </div>
      )}
    </section>
  );
}
