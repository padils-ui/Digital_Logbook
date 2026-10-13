'use client';

import { Check, Phone, TriangleAlert, User } from 'lucide-react';
import { calculateAge } from '@/lib/log-categories';
import type { Student } from '@/lib/types';

export interface EmergencyContact {
  id: string;
  student_id: string;
  contact_name: string;
  relationship: string | null;
  phone_number: string;
  is_primary_emergency: boolean;
  is_authorized_pickup: boolean;
  photo_url: string | null;
}

interface StudentCardProps {
  student: Student;
  className?: string | null;
  contacts?: EmergencyContact[];
  /** Mod pemilihan berkelompok. */
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (studentId: string) => void;
}

/**
 * Kad profil anak dengan amaran alahan merah yang menonjol.
 * Boleh digunakan sebagai kad paparan atau kad boleh pilih (batch).
 */
export function StudentCard({
  student,
  className,
  contacts = [],
  selectable = false,
  selected = false,
  onToggle,
}: StudentCardProps) {
  const age = calculateAge(student.dob);
  const allergies = student.allergies ?? [];
  const hasAllergies = allergies.length > 0;
  const primaryContact =
    contacts.find((c) => c.is_primary_emergency) ?? contacts[0] ?? null;

  const content = (
    <>
      {/* Amaran alahan — merah, menonjol */}
      {hasAllergies && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-lg border-2 border-red-300 bg-red-50 p-2.5"
        >
          <TriangleAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-red-700">
              Alahan
            </p>
            <p className="mt-0.5 break-words text-sm font-semibold text-red-800">
              {allergies.join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Foto / avatar */}
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-2 ring-white">
          {student.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={student.photo_url}
              alt={student.full_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User className="h-6 w-6 text-slate-400" aria-hidden />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-900">
            {student.full_name}
          </h3>
          {student.nickname && (
            <p className="truncate text-xs text-slate-500">
              Panggilan: {student.nickname}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {age !== null && (
              <span className="badge-slate">{age} tahun</span>
            )}
            {student.gender && (
              <span className="badge-slate">
                {student.gender === 'L' ? 'Lelaki' : 'Perempuan'}
              </span>
            )}
            {student.blood_type && (
              <span className="badge-slate">Darah {student.blood_type}</span>
            )}
          </div>
        </div>

        {selectable && (
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
              selected
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 bg-white'
            }`}
            aria-hidden
          >
            {selected && <Check className="h-4 w-4" />}
          </span>
        )}
      </div>

      <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-slate-500">MyKid</dt>
          <dd className="truncate font-medium text-slate-700">
            {student.mykid_number || '—'}
          </dd>
        </div>
        {className && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-slate-500">Kelas</dt>
            <dd className="truncate font-medium text-slate-700">{className}</dd>
          </div>
        )}
        {student.medical_conditions && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-slate-500">Perubatan</dt>
            <dd className="truncate font-medium text-slate-700">
              {student.medical_conditions}
            </dd>
          </div>
        )}
      </dl>

      {primaryContact && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-2">
          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-700">
              {primaryContact.contact_name}
              {primaryContact.relationship
                ? ` (${primaryContact.relationship})`
                : ''}
            </p>
            <p className="truncate text-xs text-slate-500">
              {primaryContact.phone_number}
            </p>
          </div>
          {primaryContact.is_authorized_pickup && (
            <span className="badge-emerald shrink-0">Penjaga</span>
          )}
        </div>
      )}
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => onToggle?.(student.id)}
        aria-pressed={selected}
        className={`card w-full text-left transition ${
          selected
            ? 'ring-2 ring-brand-600 ring-offset-1'
            : 'hover:border-slate-300'
        }`}
      >
        {content}
      </button>
    );
  }

  return <article className="card">{content}</article>;
}
