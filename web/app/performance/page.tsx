'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

import { centsToDollars, formatCents, formatDate, isSettled } from '@pb/core';
import { fetchMyPerformance, type PerformanceRow } from '@/lib/supabase/performance';

function shortDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// players/[id]/page.tsx's colours for whose money it is: green when it is the player's,
// destructive when it is gone, muted at even. net_cents from get_my_performance is already
// signed the player's way (positive = won), so positive is green here — the reverse of a
// ledger balance, where positive means the player owes the house.
function toneClass(cents: number): string {
  if (isSettled(cents)) return 'text-muted-foreground';
  return cents > 0 ? 'text-green-500' : 'text-destructive';
}

function signedAmount(cents: number): string {
  if (isSettled(cents)) return 'Even';
  return cents > 0 ? `+$${formatCents(cents)}` : `-$${formatCents(Math.abs(cents))}`;
}

// `cumulative` is dollars only because recharts picks its axis ticks from it (the reason
// stats/page.tsx gives); the running sum is taken in cents and converted once, here.
interface ChartPoint {
  row: PerformanceRow;
  date: string;
  cumulativeCents: number;
  cumulative: number;
}

function toChartPoints(rows: readonly PerformanceRow[]): ChartPoint[] {
  let runningCents = 0;
  return rows.map((row) => {
    runningCents += row.net_cents;
    return { row, date: shortDate(row.played_on), cumulativeCents: runningCents, cumulative: centsToDollars(runningCents) };
  });
}

// text-foreground because the tooltip renders inside the chart's win/loss-coloured wrapper
// and would otherwise inherit it.
function CumTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const { row, cumulativeCents } = payload[0].payload;
  return (
    <div className='bg-background text-foreground border border-border rounded px-3 py-2 text-xs shadow-md'>
      <p className='font-semibold text-primary mb-1'>{row.bar_name}</p>
      <p className='text-muted-foreground'>{formatDate(row.played_on)} · {row.session_name}</p>
      <p className='mt-1'>Running total: <span className={`font-bold ${toneClass(cumulativeCents)}`}>{signedAmount(cumulativeCents)}</span></p>
      <p>Session: <span className={`font-medium ${toneClass(row.net_cents)}`}>{signedAmount(row.net_cents)}</span></p>
    </div>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <main className='min-h-screen px-6 py-10 max-w-3xl mx-auto pb-24'>
      <div className='flex items-center justify-between mb-10'>
        <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Performance</h1>
        <button onClick={() => router.back()} className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'>Back</button>
      </div>
      {children}
    </main>
  );
}

// Loading, error and empty all render through this one component (D2). No shared DataState
// exists in web/ yet, so it is local to the page.
function StateMessage({ title, detail, tone = 'text-muted-foreground' }: { title: string; detail?: string; tone?: string }) {
  return (
    <div className='text-center py-24 space-y-2'>
      <p className={`text-xs tracking-widest uppercase ${tone}`}>{title}</p>
      {detail && <p className='text-xs text-muted-foreground max-w-xs mx-auto'>{detail}</p>}
    </div>
  );
}

function Summary({ totalCents, sessions }: { totalCents: number; sessions: number }) {
  return (
    <div className='grid grid-cols-2 gap-3 mb-10'>
      {[
        { label: 'Net', value: signedAmount(totalCents), color: toneClass(totalCents) },
        { label: 'Sessions', value: String(sessions), color: 'text-foreground' },
      ].map(({ label, value, color }) => (
        <div key={label} className='border border-border rounded-md p-4'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-1'>{label}</p>
          <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function CumulativeChart({ points, totalCents }: { points: ChartPoint[]; totalCents: number }) {
  const cumMin = Math.min(0, ...points.map((p) => p.cumulative));
  const cumMax = Math.max(0, ...points.map((p) => p.cumulative));

  return (
    <div className='border border-border rounded-md p-5 mb-6'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-6'>Cumulative Net</p>
      {/* The line strokes in currentColor, so it takes the same win/loss class as the labels. */}
      <div className={toneClass(totalCents)}>
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
      </div>
    </div>
  );
}

function SessionList({ rows }: { rows: readonly PerformanceRow[] }) {
  const newestFirst = [...rows].reverse();

  return (
    <div className='border border-border rounded-md p-5'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-2'>Sessions</p>
      <ul className='divide-y divide-border'>
        {newestFirst.map((row) => (
          <li key={row.session_id} className='flex items-start justify-between gap-3 py-3'>
            <div className='min-w-0'>
              <p className='text-sm font-medium truncate'>{row.bar_name}</p>
              <p className='text-xs text-muted-foreground mt-0.5'>{formatDate(row.played_on)}</p>
              <p className='text-xs text-muted-foreground truncate'>${formatCents(row.stakes_cents)} game · {row.session_name}</p>
            </div>
            <div className='text-right shrink-0'>
              <p className={`text-sm font-semibold tabular-nums ${toneClass(row.net_cents)}`}>{signedAmount(row.net_cents)}</p>
              <p className='text-xs text-muted-foreground'>net</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PerformanceView({ rows }: { rows: readonly PerformanceRow[] }) {
  const points = toChartPoints(rows);
  const totalCents = points[points.length - 1].cumulativeCents;

  return (
    <>
      <Summary totalCents={totalCents} sessions={rows.length} />
      <CumulativeChart points={points} totalCents={totalCents} />
      <SessionList rows={rows} />
    </>
  );
}

export default function PerformancePage() {
  const { data: rows, error } = useSWR('get_my_performance', fetchMyPerformance);

  if (error) {
    return <PageShell><StateMessage tone='text-destructive' title="Couldn't load your results" detail='Check your connection and try again.' /></PageShell>;
  }
  if (!rows) {
    return <PageShell><StateMessage title='Loading…' /></PageShell>;
  }
  if (rows.length === 0) {
    return (
      <PageShell>
        <StateMessage title='No sessions yet' detail='Once you buy in at a table, every session you play shows up here, with your running total across every host.' />
      </PageShell>
    );
  }
  return <PageShell><PerformanceView rows={rows} /></PageShell>;
}
