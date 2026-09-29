'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

import { centsToDollars, filterResults, formatDate, type PokerResult, type SourceFilter } from '@pb/core';
import { DataState } from '@/components/shared/data-state';
import { EmptyResults } from '@/components/results/results-tabs';
import { PokerResultRow, resultDetail, signedAmount, toneClass } from '@/components/results/poker-result-row';
import { SourceFilterBar, parseSourceFilter } from '@/components/results/source-filter';
import { usePokerResults } from '@/hooks/use-poker-results';

function shortDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// `cumulative` is dollars only because recharts picks its axis ticks from it (the reason
// bar-results.tsx gives); the running sum is taken in cents and converted once, here.
interface ChartPoint {
  row: PokerResult;
  date: string;
  cumulativeCents: number;
  cumulative: number;
}

function toChartPoints(rows: readonly PokerResult[]): ChartPoint[] {
  let runningCents = 0;
  return rows.map((row) => {
    runningCents += row.netCents;
    return { row, date: shortDate(row.playedOn), cumulativeCents: runningCents, cumulative: centsToDollars(runningCents) };
  });
}

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

function SessionList({ rows }: { rows: readonly PokerResult[] }) {
  const newestFirst = [...rows].reverse();

  return (
    <div className='border border-border rounded-md p-5'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-2'>Sessions</p>
      <ul className='divide-y divide-border'>
        {newestFirst.map((row) => <PokerResultRow key={`${row.source}:${row.id}`} row={row} />)}
      </ul>
    </div>
  );
}

function PerformanceView({ rows }: { rows: readonly PokerResult[] }) {
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

const ALL_TABLES = '/results?tab=poker';

// ?table=<bar id> narrows the tab to one table — member Home's cards link here (member-home
// SCOPE.md §3 O3(b)). The page is dynamic already, so reading the param here needs no Suspense.
function TableFilter({ name }: { name: string }) {
  return (
    <div className='flex items-center justify-between gap-3 mb-6'>
      <p className='text-sm font-medium truncate'>{name}</p>
      <Link href={ALL_TABLES} className='shrink-0 text-xs tracking-widest uppercase text-primary hover:text-foreground transition-colors'>
        All tables ›
      </Link>
    </div>
  );
}

// The Logged empty state's words are provisional: logged-sessions DESIGN.md "Still owed at build"
// has the owner pick them (R7) in item 24, alongside the form they will point to.
function NoSessions({ table, source }: { table: boolean; source: SourceFilter }) {
  if (table) {
    return <EmptyResults title='No sessions yet' detail='Once you buy in at this table, each session you play there shows up here.' href={ALL_TABLES} action='All tables' />;
  }
  if (source === 'logged') {
    return <EmptyResults title='No logged sessions' detail='Games you play away from a table show up here once you log them.' href={ALL_TABLES} action='All sessions' />;
  }
  return (
    <EmptyResults
      title='No sessions yet'
      detail='Once you buy in at a table, every session you play shows up here, with your running total across every host.'
      href='/join'
      action='Join a table'
    />
  );
}

/**
 * The signed-in player's own winnings: every host's table and every game they logged away from
 * one (was /performance; logged-sessions DESIGN.md D5).
 */
export function MyPoker() {
  const params = useSearchParams();
  const table = params.get('table');
  const source = parseSourceFilter(params.get('source'));
  const { results, error, retry } = usePokerResults();
  const rows = results && filterResults(results, { source, table });

  return (
    <>
      {!table && results && results.length > 0 && <SourceFilterBar active={source} />}
      <DataState rows={rows} error={error} onRetry={retry} empty={<NoSessions table={!!table} source={source} />}>
        {(loaded) => (
          <>
            {table && <TableFilter name={loaded[0].place} />}
            <PerformanceView rows={loaded} />
          </>
        )}
      </DataState>
    </>
  );
}
