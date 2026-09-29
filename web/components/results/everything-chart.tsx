'use client';

import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

import { formatDate, typeLabel } from '@pb/core';
import type { EverythingPoint } from '@/components/results/everything-results';
import { signedAmount, toneClass } from '@/components/results/poker-result-row';

// The recharts half of the Everything tab, a sibling of poker-chart.tsx (game-stakes owns that
// file, log-events PLAN.md BD-1). everything-results.tsx loads it through next/dynamic so
// recharts ships only when the chart renders.

// text-foreground because the tooltip renders inside the chart's win/loss-coloured wrapper
// and would otherwise inherit it.
function CumTooltip({ active, payload }: { active?: boolean; payload?: { payload: EverythingPoint }[] }) {
  if (!active || !payload?.length) return null;
  const { row, cumulativeCents } = payload[0].payload;
  const detail = [typeLabel(row.type), row.detail].filter(Boolean).join(' · ');
  return (
    <div className='bg-background text-foreground border border-border rounded px-3 py-2 text-xs shadow-md'>
      <p className='font-semibold text-primary mb-1'>{row.place ?? typeLabel(row.type)}</p>
      <p className='text-muted-foreground'>{formatDate(row.playedOn)} · {detail}</p>
      <p className='mt-1'>Running total: <span className={`font-bold ${toneClass(cumulativeCents)}`}>{signedAmount(cumulativeCents)}</span></p>
      <p>This one: <span className={`font-medium ${toneClass(row.netCents)}`}>{signedAmount(row.netCents)}</span></p>
    </div>
  );
}

/**
 * The running-total line, 220px tall — the placeholder in everything-results.tsx matches it. It
 * strokes in currentColor, so the caller's wrapper decides the win/loss colour.
 */
export function EverythingPlot({ points }: { points: EverythingPoint[] }) {
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
