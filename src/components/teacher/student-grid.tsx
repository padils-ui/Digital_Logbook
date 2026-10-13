'use client';

import { useMemo, useState } from 'react';
import { Search, TriangleAlert, Users } from 'lucide-react';
import { StudentCard, type EmergencyContact } from './student-card';
import type { Student } from '@/lib/types';

interface StudentGridProps {
  students: Student[];
  classNames: Record<string, string>;
  contactsByStudent: Record<string, EmergencyContact[]>;
}

/** Grid kad profil anak dengan carian dan penapis kelas. */
export function StudentGrid({
  students,
  classNames,
  contactsByStudent,
}: StudentGridProps) {
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [allergyOnly, setAllergyOnly] = useState(false);

  const classOptions = useMemo(() => {
    const ids = Array.from(
      new Set(students.map((s) => s.class_id).filter(Boolean))
    ) as string[];
    return ids.map((id) => ({ id, name: classNames[id] ?? 'Tanpa Kelas' }));
  }, [students, classNames]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter !== 'all' && s.class_id !== classFilter) return false;
      if (allergyOnly && (s.allergies ?? []).length === 0) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.nickname ?? '').toLowerCase().includes(q) ||
        (s.mykid_number ?? '').toLowerCase().includes(q)
      );
    });
  }, [students, query, classFilter, allergyOnly]);

  const allergyCount = students.filter(
    (s) => (s.allergies ?? []).length > 0
  ).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-600" aria-hidden />
          <h2 className="text-sm font-semibold text-slate-800">
            Kad Profil Anak
          </h2>
          <span className="badge-slate">{filtered.length} anak</span>
        </div>
        {allergyCount > 0 && (
          <span className="badge-red">
            <TriangleAlert className="mr-1 h-3 w-3" aria-hidden />
            {allergyCount} anak ada alahan
          </span>
        )}
      </div>

      {/* Carian & penapis */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, panggilan atau MyKid…"
            aria-label="Cari anak"
            className="input pl-9"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="Tapis mengikut kelas"
          className="input sm:w-48"
        >
          <option value="all">Semua Kelas</option>
          {classOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAllergyOnly((prev) => !prev)}
          aria-pressed={allergyOnly}
          className={`btn shrink-0 text-xs ${
            allergyOnly
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
          Alahan Sahaja
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="card text-center text-sm text-slate-500">
          Tiada anak sepadan dengan carian anda.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              className={
                student.class_id ? classNames[student.class_id] ?? null : null
              }
              contacts={contactsByStudent[student.id] ?? []}
            />
          ))}
        </div>
      )}
    </section>
  );
}
