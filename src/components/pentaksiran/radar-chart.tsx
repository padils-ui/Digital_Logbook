'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  PERMATA_DOMAINS,
  type PermataDomain,
} from '@/lib/validations/assessment';

/**
 * Carta radar enam domain PERMATA.
 *
 * Komponen klien kerana recharts bergantung pada DOM. Skor `null`
 * (domain tanpa data) dipaparkan sebagai 0 supaya bentuk radar kekal
 * lengkap dan mudah dibandingkan antara anak.
 */

/** Label Bahasa Melayu bagi setiap domain. */
const DOMAIN_LABELS: Record<PermataDomain, string> = {
  fizikal: 'Fizikal',
  bahasa: 'Bahasa',
  sahsiah: 'Sahsiah',
  awal_matematik: 'Awal Matematik',
  deria: 'Deria',
  kreativiti: 'Kreativiti',
};

export interface RadarChartProps {
  /** Skor 0–100 mengikut domain; `null`/tiada nilai dianggap 0. */
  scores: Partial<Record<PermataDomain, number | null>>;
  /** Tinggi carta dalam piksel (lalai 260). */
  height?: number;
  className?: string;
}

interface RadarPoint {
  domain: string;
  score: number;
  /** Menandakan domain yang tiada data asal. */
  missing: boolean;
}

/** Tukar skor mentah kepada siri data carta. */
function buildSeries(
  scores: Partial<Record<PermataDomain, number | null>>
): RadarPoint[] {
  return PERMATA_DOMAINS.map((domain) => {
    const raw = scores[domain];
    const missing = raw === null || raw === undefined || Number.isNaN(raw);
    const value = missing ? 0 : Math.min(100, Math.max(0, Number(raw)));
    return {
      domain: DOMAIN_LABELS[domain],
      score: value,
      missing,
    };
  });
}

export function PermataRadarChart({
  scores,
  height = 260,
  className,
}: RadarChartProps) {
  const data = buildSeries(scores);

  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fill: '#475569', fontSize: 10 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tickCount={6}
            tick={{ fill: '#94a3b8', fontSize: 9 }}
            stroke="#e2e8f0"
          />
          <Tooltip
            formatter={(value, _name, item) => {
              const point = item?.payload as RadarPoint | undefined;
              return [point?.missing ? 'Tiada data' : `${value}`, 'Skor'];
            }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
          />
          <Radar
            name="Skor Domain"
            dataKey="score"
            stroke="#1c6ef5"
            fill="#1c6ef5"
            fillOpacity={0.25}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PermataRadarChart;
