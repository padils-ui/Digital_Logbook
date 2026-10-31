import type { LucideIcon } from 'lucide-react';
import type { DistributionSlice } from '@/lib/types';
import { DonutChart, type DonutChartDatum } from '@/components/dashboard/donut-chart';

interface DistributionDonutCardProps {
  /** Tajuk kad. */
  title: string;
  /** Keterangan ringkas di bawah tajuk. */
  subtitle?: string;
  /** Ikon Lucide bagi cip tajuk. */
  icon: LucideIcon;
  /** Kelas Tailwind bagi cip ikon (contoh: `bg-brand-50 text-brand-700`). */
  iconTone: string;
  /** Potongan data (label + bilangan). */
  slices: DistributionSlice[];
  /** Warna setiap potongan mengikut susunan yang sama. */
  palette: string[];
  /** Label unit bagi jumlah di tengah donut. */
  unitLabel?: string;
}

/** Warna sandaran jika palet tidak lengkap. */
const FALLBACK_COLOR = '#94a3b8';

/**
 * Kad carta donut generik untuk analitik Papan Pemuka.
 *
 * Kad ini ialah Server Component — hanya carta Recharts yang diasingkan
 * dalam `DonutChart` (komponen klien) supaya tiada fungsi (ikon) terpaksa
 * dihantar merentas sempadan Server/Client.
 */
export function DistributionDonutCard({
  title,
  subtitle,
  icon: Icon,
  iconTone,
  slices,
  palette,
  unitLabel = 'rekod',
}: DistributionDonutCardProps) {
  const safeSlices = Array.isArray(slices) ? slices : [];
  const total = safeSlices.reduce(
    (sum, slice) => sum + (Number.isFinite(slice.value) ? slice.value : 0),
    0
  );

  const headingId = `donut-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const chartData: DonutChartDatum[] = safeSlices.map((slice, index) => ({
    label: slice.label,
    value: Number.isFinite(slice.value) ? slice.value : 0,
    fill:
      palette.length > 0
        ? palette[index % palette.length] ?? FALLBACK_COLOR
        : FALLBACK_COLOR,
  }));

  return (
    <section className="card p-5" aria-labelledby={headingId}>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconTone}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold text-slate-800">
            {title}
          </h2>
          {subtitle ? (
            <p className="truncate text-[11px] text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Tiada data untuk dipaparkan.
        </p>
      ) : (
        <>
          <div className="relative mt-2 w-full">
            <DonutChart data={chartData} unitLabel={unitLabel} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold leading-none text-slate-900">
                {total}
              </span>
              <span className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                {unitLabel}
              </span>
            </div>
          </div>

          <ul className="mt-2 space-y-1.5">
            {chartData.map((slice) => (
              <li
                key={slice.label}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.fill }}
                    aria-hidden
                  />
                  <span className="truncate">{slice.label}</span>
                </span>
                <span className="shrink-0 font-semibold text-slate-900">
                  {slice.value}
                  <span className="ml-1 font-normal text-slate-500">
                    ({Math.round((slice.value / total) * 100)}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
