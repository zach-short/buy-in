'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { breakdownByType, centsToDollars, filterByType, typeChips, type EverythingRow as Row } from '@pb/core';
import { Plus } from 'lucide-react';
import { DataState } from '@/components/shared/data-state';
import { EverythingRow } from '@/components/results/everything-row';
import { EverythingTotals, TypeBreakdown } from '@/components/results/everything-summary';
import { EmptyResults } from '@/components/results/results-tabs';
import { toneClass } from '@/components/results/poker-result-row';
import { TypeFilterBar, parseTypeFilter } from '@/components/results/type-filter';
import { Button } from '@/components/ui/button';
import { useEverythingResults } from '@/hooks/use-everything-results';

// recharts loads on its own, client-only, as My poker's plot does; the placeholder is the plot's
// exact height so the card does not jump when it arrives.
const EverythingPlot = dynamic(
  () => import('@/components/results/everything-chart').then((m) => m.EverythingPlot),
  { ssr: false, loading: () => <div aria-hidden className='h-[220px]' /> },
);

const LOG_EVENT = '/results/log';

function shortDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// `cumulative` is dollars only because recharts picks its axis ticks from it; the running sum is
// taken in cents and converted once, here (the reason my-poker.tsx gives).
export interface EverythingPoint {
  row: Row;
  date: string;
  cumulativeCents: number;
  cumulative: number;
}

function toPoints(rows: readonly Row[]): EverythingPoint[] {
  let runningCents = 0;
  return rows.map((row) => {
    runningCents += row.netCents;
    return { row, date: shortDate(row.playedOn), cumulativeCents: runningCents, cumulative: centsToDollars(runningCents) };
  });
}

function CumulativeChart({ points, totalCents }: { points: EverythingPoint[]; totalCents: number }) {
  return (
    <div className='border border-border rounded-md p-5 mb-6'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-6'>Cumulative Net</p>
      {/* The line strokes in currentColor, so it takes the same win/loss class as the labels. */}
      <div className={toneClass(totalCents)}>
        <EverythingPlot points={points} />
      </div>
    </div>
  );
}

function EntryList({ rows }: { rows: readonly Row[] }) {
  return (
    <div className='border border-border rounded-md p-5'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-2'>Entries</p>
      <ul className='divide-y divide-border'>
        {[...rows].reverse().map((row) => <EverythingRow key={row.key} row={row} />)}
      </ul>
    </div>
  );
}

// The breakdown is for the whole P&L; under one type's chip it would be a single line that
// repeats the Net above it.
function EverythingView({ rows, filtered }: { rows: readonly Row[]; filtered: boolean }) {
  const points = toPoints(rows);
  const totalCents = points[points.length - 1].cumulativeCents;
  return (
    <>
      <EverythingTotals totalCents={totalCents} entries={rows.length} />
      {!filtered && <TypeBreakdown totals={breakdownByType(rows)} />}
      <CumulativeChart points={points} totalCents={totalCents} />
      <EntryList rows={rows} />
    </>
  );
}

// Label is the owner's pick, plain register (log-events SCOPE Q4); the same look as My poker's.
function LogEventButton() {
  return (
    <Button asChild variant='outline' size='lg' className='w-full h-11 mb-6 text-xs tracking-widest uppercase'>
      <Link href={LOG_EVENT}><Plus aria-hidden='true' /> Log an event</Link>
    </Button>
  );
}

// Draft words, plain register; item 30 asks the owner for this empty state (PLAN phase 4 step 1).
function NothingYet() {
  return (
    <EmptyResults
      title='Nothing logged yet'
      detail='Every poker game you play and every event you log shows up here, with one running total.'
      href={LOG_EVENT}
      action='Log an event'
    />
  );
}

/**
 * The player's whole P&L (log-events SCOPE K2(a)): poker's home games and logged sessions plus
 * every logged event, with a per-type breakdown and a ?type= filter. My poker stays as it was,
 * so a bad night at the book never muddies a poker win rate.
 */
export function EverythingResults() {
  const params = useSearchParams();
  const { rows, error, retry } = useEverythingResults();
  const chips = rows ? typeChips(rows) : [];
  const type = parseTypeFilter(params.get('type'), chips);
  const shown = rows && filterByType(rows, type);

  return (
    <>
      <LogEventButton />
      {chips.length > 0 && <TypeFilterBar chips={chips} active={type} />}
      <DataState rows={shown} error={error} onRetry={retry} empty={<NothingYet />}>
        {(loaded) => <EverythingView rows={loaded} filtered={type !== 'all'} />}
      </DataState>
    </>
  );
}
