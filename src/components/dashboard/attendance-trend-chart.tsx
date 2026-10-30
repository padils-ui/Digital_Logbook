'use client';

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { AttendanceTrendPoint } from '@/lib/types';

interface AttendanceTrendChartProps {
  /** Titik data 7 hari terakhir (terlama → terbaharu). */
  points: AttendanceTrendPoint[];
}

/** Warna siri trend. */
const COLOR_KEHADIRAN = '#10b981';
const COLOR_LOG = '#3b82f6';

/**
 * Carta kawasan "Trend Kehadiran & Log Harian".
 *
 * Memaparkan peratus kehadiran dan peratus log harian diterima bagi tujuh
 * hari terakhir. Data dikira di pelayan dan dihantar sebagai props.
 */
export function AttendanceTrendChart({ points }: AttendanceTrendChartProps) {
  const hasData = points.some(
    (point) => point.peratus_kehadiran > 0 || point.peratus_log > 0
  );

  return (
    <section className="card p-5" aria-labelledby="attendance-trend-title">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <TrendingUp className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2
            id="attendance-trend-title"
            className="text-sm font-semibold text-slate-800"
          >
            Trend Kehadiran &amp; Log
          </h2>
          <p className="text-[11px] text-slate-500">7 hari terakhir</p>
        </div>
      </div>

      {hasData ? (
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillKehadiran" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLOR_KEHADIRAN} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={COLOR_KEHADIRAN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillLog" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLOR_LOG} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={COLOR_LOG} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickMargin={8}
                minTickGap={12}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(value: number) => `${value}%`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                width={44}
              />
              <Tooltip
                formatter={(value) => `${value}%`}
                contentStyle={{
                  borderRadius: 8,
                  borderColor: '#e2e8f0',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="peratus_kehadiran"
                name="Kehadiran"
                stroke={COLOR_KEHADIRAN}
                strokeWidth={2}
                fill="url(#fillKehadiran)"
                dot={{ r: 2 }}
              />
              <Area
                type="monotone"
                dataKey="peratus_log"
                name="Log harian"
                stroke={COLOR_LOG}
                strokeWidth={2}
                fill="url(#fillLog)"
                dot={{ r: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Tiada rekod kehadiran atau log bagi 7 hari terakhir.
        </p>
      )}
    </section>
  );
}
