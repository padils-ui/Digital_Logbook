'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import type { DistributionSlice } from '@/lib/types';

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

/**
 * Kad carta donut generik untuk analitik Papan Pemuka.
 *
 * Digunakan untuk "Pecahan Kehadiran Hari Ini" dan "Analisis Sebab
 * Ketidakhadiran". Jumlah keseluruhan dipaparkan di tengah donut.
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
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const headingId = `donut-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const chartData = slices.map((slice, index) => ({
    ...slice,
    fill: palette[index % palette.length],
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
          <div className="relative mt-2 h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {chartData.map((slice) => (
                    <Cell key={slice.label} fill={slice.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    borderColor: '#e2e8f0',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
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
