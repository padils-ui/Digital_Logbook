'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

/** Satu potongan data donut (label, bilangan, warna). */
export interface DonutChartDatum {
  label: string;
  value: number;
  fill: string;
}

interface DonutChartProps {
  /** Potongan data yang telah dimap dengan warna. */
  data: DonutChartDatum[];
  /** Label unit bagi petua tooltip (contoh: `rekod`). */
  unitLabel?: string;
}

/**
 * Carta donut Recharts (komponen klien).
 *
 * Hanya menerima data bersiri (bukan fungsi) supaya selamat dihantar
 * merentas sempadan Server/Client Component.
 */
export function DonutChart({ data, unitLabel = 'rekod' }: DonutChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="62%"
          outerRadius="92%"
          paddingAngle={2}
          stroke="#ffffff"
          strokeWidth={2}
        >
          {data.map((slice) => (
            <Cell key={slice.label} fill={slice.fill} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => `${value} ${unitLabel}`}
          contentStyle={{
            borderRadius: 8,
            borderColor: '#e2e8f0',
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
