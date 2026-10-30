'use client';

import { useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import type { CenterSettings } from '@/lib/types';
import { saveCenterSettings } from '@/app/(dashboard)/admin/tetapan/actions';

interface CenterSettingsFormProps {
  settings: CenterSettings | null;
}

/** Borang metadata rasmi pusat PAPN bagi tenant semasa. */
export function CenterSettingsForm({ settings }: CenterSettingsFormProps) {
  const [centerName, setCenterName] = useState(settings?.center_name ?? '');
  const [code, setCode] = useState(settings?.code ?? '');
  const [address, setAddress] = useState(settings?.address ?? '');
  const [phone, setPhone] = useState(settings?.phone ?? '');
  const [email, setEmail] = useState(settings?.email ?? '');
  const [academicYear, setAcademicYear] = useState(settings?.academic_year ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const result = await saveCenterSettings({
          center_name: centerName,
          code,
          address,
          phone,
          email,
          academic_year: academicYear,
        });
        if (!result.success) {
          setError(result.error ?? 'Ralat tidak diketahui.');
          return;
        }
        setMessage('Maklumat pusat berjaya disimpan.');
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">Maklumat Pusat</h2>
        <p className="mt-1 text-sm text-slate-600">
          Maklumat ini digunakan dalam laporan PDF dan dokumen rasmi pusat.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="center_name" className="label">
            Nama Pusat
          </label>
          <input
            id="center_name"
            type="text"
            value={centerName}
            onChange={(event) => setCenterName(event.target.value)}
            placeholder="cth. Pusat Anak PERMATA Negara Seri Kembangan"
            required
            className="input"
          />
        </div>

        <div>
          <label htmlFor="center_code" className="label">
            Kod PAPN
          </label>
          <input
            id="center_code"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="cth. PAPN-SLK-001"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="academic_year" className="label">
            Tahun Akademik
          </label>
          <input
            id="academic_year"
            type="text"
            value={academicYear}
            onChange={(event) => setAcademicYear(event.target.value)}
            placeholder="cth. 2026"
            className="input"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="address" className="label">
            Alamat
          </label>
          <textarea
            id="address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Alamat penuh pusat"
            rows={3}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="phone" className="label">
            Nombor Telefon
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="cth. 03-8943 1234"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="email" className="label">
            E-mel
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="cth. papn@permata.gov.my"
            className="input"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn" disabled={saving}>
          <Save className="h-4 w-4" aria-hidden />
          {saving ? 'Menyimpan…' : 'Simpan Maklumat Pusat'}
        </button>
      </div>
    </form>
  );
}
