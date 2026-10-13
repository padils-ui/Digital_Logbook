'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Save, Thermometer } from 'lucide-react';
import type { Student } from '@/lib/types';
import type { AttendanceStatus } from '@/types/attendance';
import {
  saveBatchAttendance,
  type AttendanceRecordInput,
} from '@/app/(dashboard)/teacher/kehadiran/actions';

/** Rekod kehadiran yang disimpan di server (boleh null). */
export interface AttendanceInitialRecord {
  status: string | null;
  suhu_tiba: string | null;
  suhu_balik: string | null;
  catatan: string | null;
}

interface AttendanceManagerProps {
  students: Student[];
  classNames: Record<string, string>;
  /** Tarikh terpilih dalam format ISO (YYYY-MM-DD). */
  date: string;
  /** Rekod sedia ada bagi tarikh terpilih, dikunci mengikut student_id. */
  initialRecords: Record<string, AttendanceInitialRecord>;
}

/** Draf kehadiran yang boleh diedit pada klien. */
interface AttendanceDraft {
  status: AttendanceStatus;
  suhu_tiba: string;
  suhu_balik: string;
  catatan: string;
}

/** Pilihan status kehadiran yang sah. */
const STATUS_OPTIONS: AttendanceStatus[] = ['Hadir', 'Tidak Hadir', 'Lewat'];

/** Cip suhu pantas (°C). */
const TEMP_CHIPS = ['36.2', '36.5', '36.8', '37.0'];

/** Gaya butang status mengikut pilihan. */
const STATUS_ACTIVE_CLASS: Record<AttendanceStatus, string> = {
  Hadir: 'bg-emerald-600 text-white border-emerald-600',
  'Tidak Hadir': 'bg-red-600 text-white border-red-600',
  Lewat: 'bg-amber-500 text-white border-amber-500',
};

const STATUS_BADGE_CLASS: Record<AttendanceStatus, string> = {
  Hadir: 'badge-emerald',
  'Tidak Hadir': 'badge-red',
  Lewat: 'badge-slate',
};

/** Pastikan nilai daripada server ialah status yang sah. */
function toStatus(value: string | null | undefined): AttendanceStatus {
  return value === 'Hadir' || value === 'Tidak Hadir' || value === 'Lewat'
    ? value
    : 'Hadir';
}

/** Bina draf awal daripada rekod server. */
function buildInitialDrafts(
  students: Student[],
  initialRecords: Record<string, AttendanceInitialRecord>
): Record<string, AttendanceDraft> {
  const drafts: Record<string, AttendanceDraft> = {};
  for (const student of students) {
    const existing = initialRecords[student.id];
    drafts[student.id] = {
      status: toStatus(existing?.status),
      suhu_tiba: existing?.suhu_tiba ?? '',
      suhu_balik: existing?.suhu_balik ?? '',
      catatan: existing?.catatan ?? '',
    };
  }
  return drafts;
}

/** Borang kehadiran kelompok: status, suhu tiba/balik dan catatan per anak. */
export function AttendanceManager({
  students,
  classNames,
  date,
  initialRecords,
}: AttendanceManagerProps) {
  const router = useRouter();
  const [records, setRecords] = useState<Record<string, AttendanceDraft>>(() =>
    buildInitialDrafts(students, initialRecords)
  );
  const [classFilter, setClassFilter] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<
    { type: 'success' | 'error'; text: string } | null
  >(null);
  const [, startTransition] = useTransition();

  const visibleStudents = useMemo(() => {
    if (classFilter === 'all') return students;
    if (classFilter === 'none') return students.filter((s) => !s.class_id);
    return students.filter((s) => s.class_id === classFilter);
  }, [students, classFilter]);

  const hadirCount = useMemo(
    () => visibleStudents.filter((s) => records[s.id]?.status === 'Hadir').length,
    [visibleStudents, records]
  );

  function updateRecord(studentId: string, patch: Partial<AttendanceDraft>) {
    setRecords((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], ...patch },
    }));
  }

  function handleDateChange(value: string) {
    if (!value) return;
    router.push(`/teacher/kehadiran?date=${value}`);
  }

  function handleSave() {
    setSaving(true);
    setMessage(null);
    startTransition(async () => {
      const payload: AttendanceRecordInput[] = Object.entries(records).map(
        ([student_id, r]) => ({
          student_id,
          status: r.status,
          suhu_tiba: r.suhu_tiba,
          suhu_balik: r.suhu_balik,
          catatan: r.catatan,
        })
      );

      const result = await saveBatchAttendance(date, payload);
      setSaving(false);
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error ?? 'Ralat tidak diketahui.' });
        return;
      }
      setMessage({
        type: 'success',
        text: `Kehadiran ${result.saved ?? payload.length} anak berjaya disimpan.`,
      });
    });
  }

  return (
    <div className="space-y-4">
      {/* Bar penapis tarikh & kelas */}
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="attendance-date" className="label">
            Tarikh
          </label>
          <input
            id="attendance-date"
            type="date"
            className="input w-auto"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="attendance-class" className="label">
            Kelas
          </label>
          <select
            id="attendance-class"
            className="input w-auto"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="all">Semua Kelas</option>
            {Object.entries(classNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
            <option value="none">Tanpa Kelas</option>
          </select>
        </div>
        <span className="badge-slate sm:ml-auto">
          {hadirCount} / {visibleStudents.length} hadir
        </span>
      </div>

      {message && (
        <p
          role="alert"
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </p>
      )}

      {visibleStudents.length === 0 ? (
        <div className="card text-sm text-slate-500">
          Tiada anak didaftarkan untuk kelas ini.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleStudents.map((student) => {
            const draft = records[student.id];
            if (!draft) return null;
            const className = student.class_id
              ? classNames[student.class_id] ?? 'Tanpa Kelas'
              : 'Tanpa Kelas';

            return (
              <div key={student.id} className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {student.full_name}
                    </p>
                    <p className="text-xs text-slate-500">{className}</p>
                  </div>
                  <span className={STATUS_BADGE_CLASS[draft.status]}>
                    {draft.status}
                  </span>
                </div>

                {/* Status kehadiran */}
                <div>
                  <span className="label">Status Kehadiran</span>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((status) => {
                      const active = draft.status === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateRecord(student.id, { status })}
                          aria-pressed={active}
                          className={`min-h-touch rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                            active
                              ? STATUS_ACTIVE_CLASS[status]
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Suhu tiba & balik */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      { key: 'suhu_tiba', label: 'Suhu Tiba (°C)' },
                      { key: 'suhu_balik', label: 'Suhu Balik (°C)' },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key}>
                      <label
                        htmlFor={`${key}-${student.id}`}
                        className="label flex items-center gap-1"
                      >
                        <Thermometer className="h-3.5 w-3.5" aria-hidden />
                        {label}
                      </label>
                      <input
                        id={`${key}-${student.id}`}
                        type="text"
                        inputMode="decimal"
                        className="input"
                        placeholder="cth. 36.5"
                        value={draft[key]}
                        onChange={(e) =>
                          updateRecord(student.id, { [key]: e.target.value })
                        }
                      />
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {TEMP_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => updateRecord(student.id, { [key]: chip })}
                            className="chip"
                          >
                            {chip}°C
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Catatan */}
                <div>
                  <label
                    htmlFor={`catatan-${student.id}`}
                    className="label"
                  >
                    Catatan (pilihan)
                  </label>
                  <textarea
                    id={`catatan-${student.id}`}
                    className="input min-h-[64px]"
                    rows={2}
                    placeholder="Catatan tambahan berkaitan kehadiran..."
                    value={draft.catatan}
                    onChange={(e) =>
                      updateRecord(student.id, { catatan: e.target.value })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bar simpan melekit */}
      <div className="sticky bottom-4 z-10">
        <div className="card flex flex-wrap items-center justify-between gap-3 shadow-md">
          <p className="text-sm text-slate-600">
            <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" aria-hidden />
            {students.length} anak dimuatkan untuk {date}
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || students.length === 0}
            className="btn-primary"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            Simpan Kehadiran
          </button>
        </div>
      </div>
    </div>
  );
}
