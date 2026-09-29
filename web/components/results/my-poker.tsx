'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { centsToDollars, filterResults, type PokerResult, type SourceFilter } from '@pb/core';
import { Plus } from 'lucide-react';
import { DataState } from '@/components/shared/data-state';
import { EmptyResults } from '@/components/results/results-tabs';
import { PokerResultRow, signedAmount, toneClass } from '@/components/results/poker-result-row';
import { SourceFilterBar, parseSourceFilter } from '@/components/results/source-filter';
import { Button } from '@/components/ui/button';
import { usePokerResults } from '@/hooks/use-poker-results';

// recharts is ~120KB gzipped, so the plot loads on its own, client-only (it measures the DOM).
// The placeholder is the plot's exact height, so the card does not jump when it arrives.
const CumulativeNetPlot = dynamic(
  () => import('@/components/results/poker-chart').then((m) => m.CumulativeNetPlot),
  { ssr: false, loading: () => <div aria-hidden className='h-[220px]' /> },
);

function shortDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// `cumulative` is dollars only because recharts picks its axis ticks from it (the reason
// bar-results.tsx gives); the running sum is taken in cents and converted once, here.
export interface ChartPoint {
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
  return (
    <div className='border border-border rounded-md p-5 mb-6'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-6'>Cumulative Net</p>
      {/* The line strokes in currentColor, so it takes the same win/loss class as the labels. */}
      <div className={toneClass(totalCents)}>
        <CumulativeNetPlot points={points} />
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
const LOG_SESSION = '/results/log';

// The entry point to logging a game away from any table (DESIGN.md D6; label owner-picked). It
// shows on the empty tab too, so a player with no home games still has a way in besides Join.
function LogSessionButton() {
  return (
    <Button asChild variant='outline' size='lg' className='w-full h-11 mb-6 text-xs tracking-widest uppercase'>
      <Link href={LOG_SESSION}><Plus aria-hidden='true' /> Log an event</Link>
    </Button>
  );
}

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

// The Logged empty state's words are the owner's pick, plain register, 2026-09-29
// (logged-sessions DESIGN.md "Still owed at build").
function NoSessions({ table, source }: { table: boolean; source: SourceFilter }) {
  if (table) {
    return <EmptyResults title='No sessions yet' detail='Once you buy in at this table, each session you play there shows up here.' href={ALL_TABLES} action='All tables' />;
  }
  if (source === 'logged') {
    return <EmptyResults title='No logged sessions' detail='Games you play away from a table show up here once you log them.' href={LOG_SESSION} action='Log a session' />;
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
      {!table && <LogSessionButton />}
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
