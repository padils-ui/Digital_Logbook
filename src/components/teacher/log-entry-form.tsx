'use client';

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import imageCompression from 'browser-image-compression';
import {
  Camera,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Save,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import {
  LOG_CATEGORIES,
  getCategory,
  type LogCategory,
  type LogField,
} from '@/lib/log-categories';
import { saveDailyLogs } from '@/app/(dashboard)/teacher/actions';
import {
  VoiceRecorder,
  TAB_KEY_TO_CATEGORY,
  type VoiceLogResult,
} from './voice-recorder';
import type { Student } from '@/lib/types';

interface LogEntryFormProps {
  students: Student[];
  classNames: Record<string, string>;
}

/**
 * Borang log harian dengan susunan baharu:
 * 1. Pilih Anak & Mod Kelompok
 * 2. Tab kategori & medan borang (foto bebas per tab)
 * 3. Rakam Suara (AI)
 * 4. Butang Simpan Log
 */
export function LogEntryForm({ students, classNames }: LogEntryFormProps) {
  const [category, setCategory] = useState<LogCategory>('meals');
  // Nilai medan borang per kategori, dikongsi dalam satu map.
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [logDate, setLogDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  // Foto berasingan bagi setiap tab kategori: { [category]: dataUrl }
  const [tabPhotos, setTabPhotos] = useState<Record<string, string>>({});
  // Foto bagi medan jenis 'image' (kluster Aktiviti Anak): { [fieldName]: dataUrl }
  const [fieldPhotos, setFieldPhotos] = useState<Record<string, string>>({});
  // Kategori yang sedang memampatkan imej (untuk penunjuk memuat).
  const [compressing, setCompressing] = useState<LogCategory | null>(null);
  // Medan imej yang sedang memampatkan imej (untuk penunjuk memuat).
  const [compressingField, setCompressingField] = useState<string | null>(null);
  // Kategori yang menerima data AI — untuk penunjuk pada tab.
  const [aiTabs, setAiTabs] = useState<LogCategory[]>([]);
  const [message, setMessage] = useState<{
    type: 'ok' | 'error';
    text: string;
  } | null>(null);
  // Pautan folder Google Drive selepas simpan berjaya.
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Ref untuk input fail foto bagi setiap tab
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // Ref untuk input fail foto bagi setiap medan jenis 'image'
  const fieldPhotoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeCategory = useMemo(() => getCategory(category), [category]);
  // Nilai borang untuk tab aktif sahaja
  const currentValues = values[category] ?? {};

  // Kumpulkan medan tab aktif mengikut seksyen (kluster Aktiviti Anak).
  const groupedFields = useMemo(() => {
    const groups: { section: string | null; fields: LogField[] }[] = [];
    activeCategory.fields.forEach((field) => {
      const section = field.section ?? null;
      const last = groups[groups.length - 1];
      if (last && last.section === section) {
        last.fields.push(field);
      } else {
        groups.push({ section, fields: [field] });
      }
    });
    return groups;
  }, [activeCategory]);

  // Tab kategori ini menggunakan medan imej kluster (bukan foto tunggal per tab).
  const hasImageFields = activeCategory.fields.some((f) => f.type === 'image');

  const selectedStudents = useMemo(
    () => students.filter((s) => selectedIds.includes(s.id)),
    [students, selectedIds]
  );

  function handleCategoryChange(next: LogCategory) {
    setCategory(next);
    setMessage(null);
  }

  function handleFieldChange(name: string, value: string) {
    setValues((prev) => ({
      ...prev,
      [category]: { ...(prev[category] ?? {}), [name]: value },
    }));
  }

  /**
   * Chip pintar: muatkan semua fieldValues ke dalam state borang tab aktif.
   * Mengatasi nilai sedia ada bagi medan yang dinyatakan sahaja.
   */
  function applyChip(fieldValues: Record<string, string>) {
    setValues((prev) => ({
      ...prev,
      [category]: { ...(prev[category] ?? {}), ...fieldValues },
    }));
  }

  function toggleStudent(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function selectAll() {
    setSelectedIds(students.map((s) => s.id));
  }

  function deselectAll() {
    setSelectedIds([]);
  }

  // Kendalikan muat naik foto — mampatkan di klien dahulu, simpan ke tabPhotos[category]
  const handlePhotoChange = useCallback(
    (cat: LogCategory) => async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setCompressing(cat);
      setMessage(null);
      try {
        // Mampatkan imej: maksimum 0.5MB dan lebar/tinggi maksimum 1200px.
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          initialQuality: 0.8,
        });

        const dataUrl = await imageCompression.getDataUrlFromFile(compressed);
        setTabPhotos((prev) => ({ ...prev, [cat]: dataUrl }));
      } catch {
        setMessage({
          type: 'error',
          text: 'Gagal memampatkan gambar. Sila cuba gambar lain.',
        });
      } finally {
        setCompressing(null);
      }
    },
    []
  );

  function removePhoto(cat: LogCategory) {
    setTabPhotos((prev) => {
      const next = { ...prev };
      delete next[cat];
      return next;
    });
    const ref = photoInputRefs.current[cat];
    if (ref) ref.value = '';
  }

  // Kendalikan muat naik foto bagi medan jenis 'image' (kluster Aktiviti Anak).
  const handleFieldPhotoChange = useCallback(
    (fieldName: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setCompressingField(fieldName);
      setMessage(null);
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          initialQuality: 0.8,
        });

        const dataUrl = await imageCompression.getDataUrlFromFile(compressed);
        setFieldPhotos((prev) => ({ ...prev, [fieldName]: dataUrl }));
      } catch {
        setMessage({
          type: 'error',
          text: 'Gagal memampatkan gambar. Sila cuba gambar lain.',
        });
      } finally {
        setCompressingField(null);
      }
    },
    []
  );

  function removeFieldPhoto(fieldName: string) {
    setFieldPhotos((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
    const ref = fieldPhotoRefs.current[fieldName];
    if (ref) ref.value = '';
  }

  /**
   * Auto-isi borang daripada hasil AI — penghalaan berbilang tab.
   * Setiap tab yang hadir dalam dataByTab dikemas kini secara berasingan.
   */
  function handleVoiceResult(result: VoiceLogResult) {
    const updatedCats: LogCategory[] = [];

    setValues((prev) => {
      const updated = { ...prev };
      Object.keys(result.dataByTab).forEach((tabKey) => {
        const cat = TAB_KEY_TO_CATEGORY[tabKey];
        const fields = result.dataByTab[tabKey];
        if (!cat || !fields) return;

        const next: Record<string, string> = {};
        Object.entries(fields).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            next[key] = String(value);
          }
        });
        if (Object.keys(next).length === 0) return;

        updated[cat] = { ...(updated[cat] ?? {}), ...next };
        if (!updatedCats.includes(cat)) updatedCats.push(cat);
      });
      return updated;
    });

    // Tandakan tab yang menerima data AI.
    setAiTabs(updatedCats);

    // Fokuskan tab pertama yang dikemas kini supaya pendidik terus nampak hasilnya.
    if (updatedCats.length > 0) {
      setCategory(updatedCats[0]);
    }

    // NOTA: AI TIDAK boleh mengatasi pilihan anak pendidik. Pilihan anak
    // dalam bahagian "Pilih Anak" ialah SUMBER KEBENARAN MUTLAK.
    // Nama anak yang disebut oleh AI hanya digunakan sebagai maklumat
    // konteks dalam mesej sahaja, BUKAN untuk menukar selectedIds.

    setMessage({
      type: 'ok',
      text:
        updatedCats.length > 1
          ? `AI telah mengisi ${updatedCats.length} tab. Sila semak sebelum menyimpan.`
          : 'AI telah mengisi borang. Sila semak sebelum menyimpan.',
    });
  }

  function handleSubmit() {
    setMessage(null);
    setDriveLink(null);

    // ── Pengesahan klien: anak mesti dipilih ──────────────────
    if (!selectedIds.length) {
      setMessage({
        type: 'error',
        text: "Sila pilih sekurang-kurangnya seorang anak di bahagian 'Pilih Anak' di atas.",
      });
      return;
    }

    // Pastikan semua ID adalah UUID yang sah (format asas).
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = selectedIds.filter((id) => !uuidRegex.test(id));
    if (invalidIds.length > 0) {
      setMessage({
        type: 'error',
        text: 'ID anak tidak sah. Sila muat semula halaman dan pilih anak semula.',
      });
      return;
    }

    // Kumpul semua entri dari semua tab yang mempunyai kandungan
    const entriesToSave: any[] = [];
    
    LOG_CATEGORIES.forEach((catDef) => {
      const catKey = catDef.value;
      const catValues = values[catKey] ?? {};

      // Gabungkan nilai medan imej kluster (jenis 'image') ke dalam kandungan
      // supaya foto_bebas / foto_luar / foto_permata disimpan bersama kandungan.
      const imageValues: Record<string, string> = {};
      catDef.fields.forEach((f) => {
        if (f.type === 'image' && fieldPhotos[f.name]) {
          imageValues[f.name] = fieldPhotos[f.name];
        }
      });
      const content = { ...catValues, ...imageValues };

      const hasContent = Object.values(content).some(
        (v) => v.toString().trim() !== ''
      );
      const photo = tabPhotos[catKey] ?? null;

      if (hasContent || photo) {
        entriesToSave.push({
          category: catKey,
          content,
          imageDataUrl: photo,
        });
      }
    });

    if (!entriesToSave.length) {
      setMessage({
        type: 'error',
        text: 'Sila isi sekurang-kurangnya satu medan log dalam mana-mana tab.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveDailyLogs({
          studentIds: selectedIds,
          logDate,
          entries: entriesToSave,
        });

        if (result.success === false) {
          setMessage({
            type: 'error',
            text: result.error ?? 'Gagal menyimpan log.',
          });
          return;
        }

        setMessage({
          type: 'ok',
          text: 'Log berjaya disimpan',
        });
        setDriveLink(result.driveFolderUrl ?? null);
        
        // Kosongkan semua medan dan foto yang telah disimpan
        setValues({});
        setTabPhotos({});
        setFieldPhotos({});
        setSelectedIds([]);
        setBatchMode(false);
      } catch (err) {
        // Jaring keselamatan: server action tidak sepatutnya melontar, tetapi
        // jika ia berlaku, paparkan toast merah dan kekal di halaman ini.
        setMessage({
          type: 'error',
          text:
            err instanceof Error
              ? err.message
              : 'Ralat tidak dijangka semasa menyimpan log.',
        });
      }
    });
  }

  /** Bina satu medan borang (teks/textarea/select/nombor/imej). */
  function renderField(field: LogField) {
    // Medan imej kluster — pemuat naik gambar bersebelahan medan lain.
    if (field.type === 'image') {
      const dataUrl = fieldPhotos[field.name];
      return (
        <div key={field.name} className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {field.label}
          </label>
          {compressingField === field.name ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" aria-hidden />
              <span className="text-xs text-slate-600">Memampatkan gambar…</span>
            </div>
          ) : dataUrl ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUrl}
                alt={field.label}
                className="h-28 w-28 rounded-lg object-cover ring-1 ring-slate-200"
              />
              <button
                type="button"
                onClick={() => removeFieldPhoto(field.name)}
                aria-label="Buang gambar"
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 transition hover:border-brand-400 hover:bg-brand-50">
              <Camera className="h-5 w-5 text-slate-400" aria-hidden />
              <span className="text-xs text-slate-600">Pilih foto dari peranti</span>
              <input
                ref={(el) => {
                  fieldPhotoRefs.current[field.name] = el;
                }}
                type="file"
                accept="image/*"
                onChange={handleFieldPhotoChange(field.name)}
                className="sr-only"
              />
            </label>
          )}
        </div>
      );
    }

    return (
      <div
        key={field.name}
        className={field.type === 'textarea' ? 'sm:col-span-2' : ''}
      >
        <label
          htmlFor={`field-${field.name}`}
          className="mb-1 block text-xs font-semibold text-slate-700"
        >
          {field.label}
          {field.suffix ? ` (${field.suffix})` : ''}
        </label>
        {field.type === 'textarea' ? (
          <textarea
            id={`field-${field.name}`}
            rows={3}
            value={currentValues[field.name] ?? ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className="input resize-y"
          />
        ) : field.type === 'select' ? (
          <select
            id={`field-${field.name}`}
            value={currentValues[field.name] ?? ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className="input"
          >
            <option value="">— Pilih —</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`field-${field.name}`}
            type={field.type === 'number' ? 'number' : 'text'}
            step={field.type === 'number' ? '0.1' : undefined}
            value={currentValues[field.name] ?? ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className="input"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── 1. Pilih Anak & Mod Kelompok ───────────────────────── */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-600" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-800">
              Pilih Anak
            </h3>
            {selectedIds.length > 0 && (
              <span className="badge-slate">{selectedIds.length} dipilih</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {batchMode && (
              <>
                <button
                  type="button"
                  onClick={selectAll}
                  className="btn bg-slate-100 text-xs text-slate-700 hover:bg-slate-200"
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="btn bg-slate-100 text-xs text-slate-700 hover:bg-slate-200"
                >
                  Nyahpilih Semua
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setBatchMode((prev) => !prev);
                if (batchMode) setSelectedIds([]);
              }}
              className={`btn text-xs ${
                batchMode
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {batchMode ? 'Mod Kelompok: Aktif' : 'Mod Kelompok'}
            </button>
          </div>
        </div>

        {!batchMode ? (
          <div className="mt-3">
            <label
              htmlFor="single-student"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Anak
            </label>
            <select
              id="single-student"
              value={selectedIds[0] ?? ''}
              onChange={(e) =>
                setSelectedIds(e.target.value ? [e.target.value] : [])
              }
              className="input"
            >
              <option value="">— Pilih anak —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.class_id && classNames[s.class_id]
                    ? ` — ${classNames[s.class_id]}`
                    : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mt-3">
            <p className="mb-2 text-xs text-slate-500">
              Pilih berbilang anak untuk log yang sama.
            </p>
            <div className="flex flex-wrap gap-2">
              {students.map((s) => {
                const active = selectedIds.includes(s.id);
                const hasAllergy = (s.allergies ?? []).length > 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStudent(s.id)}
                    aria-pressed={active}
                    className={`flex min-h-touch items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'
                    }`}
                  >
                    {hasAllergy && (
                      <TriangleAlert
                        className={`h-3 w-3 ${active ? 'text-white' : 'text-red-600'}`}
                        aria-label="Ada alahan"
                      />
                    )}
                    {s.full_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedStudents.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
            {selectedStudents.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700"
              >
                {s.full_name}
                <button
                  type="button"
                  onClick={() => toggleStudent(s.id)}
                  aria-label={`Buang ${s.full_name}`}
                  className="rounded-full p-0.5 hover:bg-brand-100"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── 2. Tab kategori & medan borang ──────────────────────── */}
      <div className="card p-0">
        <div
          role="tablist"
          aria-label="Kategori log"
          className="flex gap-1 overflow-x-auto border-b border-slate-200 p-2"
        >
          {LOG_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = cat.value === category;
            const aiFilled = aiTabs.includes(cat.value);
            return (
              <button
                key={cat.value}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => handleCategoryChange(cat.value)}
                className={`relative flex min-h-touch shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? `${cat.tone} text-white`
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {cat.label}
                {aiFilled && (
                  <span
                    aria-label="Diisi oleh AI"
                    title="Diisi oleh AI"
                    className={`ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      active
                        ? 'bg-white/25 text-white'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    ✨
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-4 p-4">
          <p className="text-xs text-slate-500">{activeCategory.description}</p>

          {/* Chip pantas — mengisi medan secara pintar */}
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-700">
              Pilihan Pantas
            </p>
            <div className="flex flex-wrap gap-2">
              {activeCategory.chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => applyChip(chip.fieldValues)}
                  className="chip"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Medan borang untuk tab aktif (dikelompokkan mengikut seksyen) */}
          <div className="space-y-4">
            {groupedFields.map((group, gi) => (
              <div key={group.section ?? `group-${gi}`} className="space-y-2">
                {group.section && (
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-brand-500"
                      aria-hidden
                    />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-brand-700">
                      {group.section}
                    </h4>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.fields.map((field) => renderField(field))}
                </div>
              </div>
            ))}
          </div>

          {/* ── Foto bebas per tab (dilangkau jika tab guna medan imej kluster) ── */}
          {!hasImageFields && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                Gambar / Foto Aktiviti{' '}
                <span className="font-normal text-slate-400">(Opsional)</span>
              </p>

              {compressing === category ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-brand-600" aria-hidden />
                  <span className="text-xs text-slate-600">
                    Memampatkan gambar…
                  </span>
                </div>
              ) : tabPhotos[category] ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tabPhotos[category]}
                    alt="Pratonton foto aktiviti"
                    className="h-32 w-32 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(category)}
                    aria-label="Buang gambar"
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <p className="mt-1 text-xs text-slate-500">Buang Gambar</p>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 transition hover:border-brand-400 hover:bg-brand-50">
                  <Camera className="h-5 w-5 text-slate-400" aria-hidden />
                  <span className="text-xs text-slate-600">
                    Pilih foto dari peranti
                  </span>
                  <input
                    ref={(el) => {
                      photoInputRefs.current[category] = el;
                    }}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange(category)}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          )}

          {/* Tarikh log */}
          <div className="max-w-xs">
            <label
              htmlFor="log-date"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Tarikh Log
            </label>
            <input
              id="log-date"
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* ── 3. Rakam Suara (AI) ─────────────────────────────────── */}
      <VoiceRecorder onResult={handleVoiceResult} />

      {/* ── 4. Mesej maklum balas & butang Simpan Log ───────────── */}
      {message && (
        <p
          role="alert"
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            message.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          )}
          {message.text}
        </p>
      )}

      {/* ── Notifikasi kejayaan + pautan folder Google Drive ────── */}
      {driveLink && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"
        >
          <div className="flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>Fail log telah dimuat naik ke Google Drive.</span>
          </div>
          <a
            href={driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Buka Folder Google Drive
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="btn-primary w-full sm:w-auto"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Save className="h-4 w-4" aria-hidden />
        )}
        {isPending
          ? 'Menyimpan…'
          : `Simpan Log${selectedIds.length > 1 ? ` (${selectedIds.length} anak)` : ''}`}
      </button>
    </div>
  );
}
