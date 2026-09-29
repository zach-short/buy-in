'use client';

import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

import { formatDate } from '@pb/core';
import type { ChartPoint } from '@/components/results/my-poker';
import { resultDetail, signedAmount, toneClass } from '@/components/results/poker-result-row';

// The recharts half of the poker tab. my-poker.tsx loads it through next/dynamic so recharts
// ships only when the chart actually renders, never in the chunk every results route shares.

// text-foreground because the tooltip renders inside the chart's win/loss-coloured wrapper
// and would otherwise inherit it.
function CumTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const { row, cumulativeCents } = payload[0].payload;
  return (
    <div className='bg-background text-foreground border border-border rounded px-3 py-2 text-xs shadow-md'>
      <p className='font-semibold text-primary mb-1'>{row.place}</p>
      <p className='text-muted-foreground'>{formatDate(row.playedOn)} · {resultDetail(row)}</p>
      <p className='mt-1'>Running total: <span className={`font-bold ${toneClass(cumulativeCents)}`}>{signedAmount(cumulativeCents)}</span></p>
      <p>Session: <span className={`font-medium ${toneClass(row.netCents)}`}>{signedAmount(row.netCents)}</span></p>
    </div>
  );
}

/**
 * The running-total line, 220px tall — the placeholder in my-poker.tsx matches it. It strokes in
 * currentColor, so the caller's wrapper decides the win/loss colour.
 */
export function CumulativeNetPlot({ points }: { points: ChartPoint[] }) {
  const cumMin = Math.min(0, ...points.map((p) => p.cumulative));
  const cumMax = Math.max(0, ...points.map((p) => p.cumulative));

  return (
    <ResponsiveContainer width='100%' height={220}>
      <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' vertical={false} />
        <XAxis
          dataKey='date'
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          tickFormatter={(v: number) => `$${v}`}
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          width={52}
          domain={[cumMin - 5, cumMax + 5]}
        />
        <Tooltip content={<CumTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
        <ReferenceLine y={0} stroke='var(--border)' strokeDasharray='4 2' />
        <Line
          type='monotone'
          dataKey='cumulative'
          stroke='currentColor'
          strokeWidth={2}
          dot={points.length <= 12 ? { r: 3, fill: 'currentColor', strokeWidth: 0 } : false}
          activeDot={{ r: 5, fill: 'currentColor', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
