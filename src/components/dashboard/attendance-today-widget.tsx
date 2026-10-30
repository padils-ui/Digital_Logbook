import { CheckCircle2, Clock, UserX, Users } from 'lucide-react';

interface AttendanceTodayWidgetProps {
  /** Bilangan anak berstatus `Hadir`. */
  present: number;
  /** Bilangan anak berstatus `Lewat` (dikira hadir). */
  late: number;
  /** Bilangan anak berstatus `Tidak Hadir`. */
  absent: number;
  /** Jumlah anak berdaftar dalam pusat. */
  totalStudents: number;
  /** Label tarikh hari ini (contoh: `30 Okt 2026`). */
  dateLabel: string;
}

/**
 * Widget "Kehadiran Anak Hari Ini" pada Papan Pemuka.
 *
 * Peratus kehadiran dikira daripada jumlah anak berdaftar; anak yang belum
 * direkod kehadirannya tidak dikira sebagai hadir mahupun tidak hadir.
 */
export function AttendanceTodayWidget({
  present,
  late,
  absent,
  totalStudents,
  dateLabel,
}: AttendanceTodayWidgetProps) {
  const hadir = present + late;
  const peratus = totalStudents > 0 ? Math.round((hadir / totalStudents) * 100) : 0;
  const belumDirekod = Math.max(totalStudents - hadir - absent, 0);

  const tiles = [
    {
      label: 'Hadir',
      value: hadir,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Lewat',
      value: late,
      icon: Clock,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Tidak Hadir',
      value: absent,
      icon: UserX,
      tone: 'bg-red-50 text-red-700',
    },
  ];

  return (
    <section className="card p-5" aria-labelledby="attendance-today-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Users className="h-4 w-4" aria-hidden />
          </span>
          <h2 id="attendance-today-title" className="text-sm font-semibold text-slate-800">
            Kehadiran Anak Hari Ini
          </h2>
        </div>
        <span className="text-xs text-slate-500">{dateLabel}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.label}
              className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-center"
            >
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tile.tone}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <p className="mt-2 text-xl font-bold text-slate-900">{tile.value}</p>
              <p className="text-[11px] text-slate-500">{tile.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Peratus kehadiran</span>
          <span className="font-semibold text-slate-900">{peratus}%</span>
        </div>
        <div
          className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={peratus}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Peratus kehadiran anak hari ini"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${peratus}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {hadir} daripada {totalStudents} anak berdaftar
          {belumDirekod > 0 ? ` · ${belumDirekod} belum direkod` : ''}
        </p>
      </div>
    </section>
  );
}
