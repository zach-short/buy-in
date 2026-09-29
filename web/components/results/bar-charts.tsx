'use client';

import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

import type { SessionStat } from '@/components/results/bar-results';

// The recharts half of the bar tab. bar-results.tsx loads it through next/dynamic so recharts
// ships only when a chart actually renders, never in the chunk every results route shares.

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function CumTooltip({ active, payload }: { active?: boolean; payload?: { payload: SessionStat }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className='bg-background border border-border rounded px-3 py-2 text-xs shadow-md'>
      <p className='font-semibold text-primary mb-1'>{d.name}</p>
      <p className='text-muted-foreground'>{d.date}</p>
      <p className='mt-1'>Cumulative profit: <span className={`font-bold ${d.cumProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(d.cumProfit)}</span></p>
      <p>Night profit: <span className='font-medium'>{fmt(d.profit)}</span></p>
    </div>
  );
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; fill: string }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className='bg-background border border-border rounded px-3 py-2 text-xs shadow-md'>
      {payload.map((p) => (
        <p key={p.name}>
          {p.name}: <span className='font-medium' style={{ color: p.fill }}>{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** The cumulative-profit area chart, 220px tall — the placeholder in bar-results.tsx matches it. */
export function CumulativeProfitPlot({ data, profitCents }: { data: SessionStat[]; profitCents: number }) {
  const cumMin = Math.min(0, ...data.map((d) => d.cumProfit));
  const cumMax = Math.max(0, ...data.map((d) => d.cumProfit));
  const profitColor = profitCents >= 0 ? 'var(--primary)' : 'var(--destructive)';

  return (
    <ResponsiveContainer width='100%' height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id='profitGrad' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='5%' stopColor={profitColor} stopOpacity={0.15} />
            <stop offset='95%' stopColor={profitColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' vertical={false} />
        <XAxis dataKey='date' tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} dy={6} />
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
        <Area
          type='monotone'
          dataKey='cumProfit'
          stroke={profitColor}
          strokeWidth={2}
          fill='url(#profitGrad)'
          dot={data.length <= 12 ? { r: 3, fill: profitColor, strokeWidth: 0 } : false}
          activeDot={{ r: 5, fill: profitColor, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Revenue beside cost for each night, 200px tall — the placeholder in bar-results.tsx matches it. */
export function RevenueCostPlot({ data }: { data: SessionStat[] }) {
  return (
    <ResponsiveContainer width='100%' height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap='30%'>
        <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' vertical={false} />
        <XAxis dataKey='date' tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} dy={6} />
        <YAxis
          tickFormatter={(v: number) => `$${v}`}
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--muted)' }} />
        <Bar dataKey='revenue' name='Revenue' fill='var(--primary)' radius={[2, 2, 0, 0]} opacity={0.9} />
        <Bar dataKey='cost' name='Cost' fill='var(--muted-foreground)' radius={[2, 2, 0, 0]} opacity={0.5} />
      </BarChart>
    </ResponsiveContainer>
  );
}
