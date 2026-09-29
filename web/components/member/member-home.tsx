'use client';

import { useState } from 'react';
import Link from 'next/link';

import { formatCents, isSettled, type RsvpAnswer, type TableRecord, type TableWithGame } from '@pb/core';
import { Home, Plus, X } from 'lucide-react';
import { NextGameRow } from '@/components/member/next-game';
import { DataState } from '@/components/shared/data-state';
import { Button } from '@/components/ui/button';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { useHostPrompt } from '@/hooks/use-host-prompt';
import { useTableRecords } from '@/hooks/use-table-records';
import { MEMBER_HOME_TABLE_LIMIT } from '@/lib/config';

// Copy chosen by the owner 2026-09-29, plain register (member-home SCOPE.md §7, build-time answers).
const EMPTY = "You're not at any tables yet. Ask a host for an invite link.";

// Account's Host your own table row goes here too (use-welcome.ts).
const HOST_TABLE = '/welcome?role=host';

// Results' own form route (fcadc3b); saving returns to Results → poker, not here.
const LOG_SESSION = '/results/log';

// my-poker.tsx's colours and signs: net is the player's way round, so positive is a win.
function netLine(record: TableRecord): { text: string; tone: string } {
  if (record.games === 0) return { text: 'No games yet', tone: 'text-muted-foreground' };
  const games = `${record.games} ${record.games === 1 ? 'game' : 'games'}`;
  if (isSettled(record.netCents)) return { text: `${games} · Even`, tone: 'text-muted-foreground' };
  const sign = record.netCents > 0 ? '+' : '-';
  const tone = record.netCents > 0 ? 'text-green-500' : 'text-destructive';
  return { text: `${games} · ${sign}$${formatCents(Math.abs(record.netCents))}`, tone };
}

type Answer = (gameId: string, status: RsvpAnswer) => Promise<void>;

// The record half stays the link to Results; the next game sits below it, outside the link, so
// answering never navigates.
function TableCard({ record, onAnswer }: { record: TableWithGame; onAnswer: Answer }) {
  const line = netLine(record);
  return (
    <li className='border border-border rounded-md has-[>a:hover]:border-primary/50 transition-colors'>
      <Link
        href={`/results?tab=poker&table=${record.barId}`}
        className='flex items-center justify-between gap-4 p-4'
      >
        <div className='min-w-0'>
          <p className='text-sm font-medium truncate'>{record.barName}</p>
          <p className={`text-xs tabular-nums ${line.tone}`}>{line.text}</p>
        </div>
        <span className='text-primary text-xs'>›</span>
      </Link>
      {record.nextGame && <NextGameRow game={record.nextGame} onAnswer={onAnswer} />}
    </li>
  );
}

function TableList({ records, onAnswer }: { records: TableWithGame[]; onAnswer: Answer }) {
  const [all, setAll] = useState(false);
  const shown = all ? records : records.slice(0, MEMBER_HOME_TABLE_LIMIT);
  return (
    <>
      <ul className='flex flex-col gap-3'>
        {shown.map((record) => <TableCard key={record.barId} record={record} onAnswer={onAnswer} />)}
      </ul>
      {shown.length < records.length && (
        <button
          type='button'
          onClick={() => setAll(true)}
          className='mt-4 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
        >
          Show all {records.length}
        </button>
      )}
    </>
  );
}

// The same look as Results' LogSessionButton (my-poker.tsx), not an import of it: member/ does not
// reach into results/. Label owner-picked (logged-sessions DESIGN.md D6). Under the tables, outside
// DataState, so an account at no table can still log a casino game (owner, 2026-09-29, item 26).
function LogSessionButton() {
  return (
    <Button asChild variant='outline' size='lg' className='w-full h-11 mt-6 text-xs tracking-widest uppercase'>
      <Link href={LOG_SESSION}><Plus aria-hidden='true' /> Log a session</Link>
    </Button>
  );
}

// Above the tables so a signed-in account that hosts nowhere sees the way in first; the X is the
// only way it goes, and it stays gone on this browser.
function HostTableCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className='relative mb-10'>
      <Button asChild size='lg' className='w-full h-12 text-sm tracking-widest uppercase font-medium'>
        <Link href={HOST_TABLE}><Home aria-hidden='true' /> Host a table</Link>
      </Button>
      <button
        type='button'
        aria-label='Dismiss'
        onClick={onDismiss}
        className='absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-1 text-primary-foreground/70 hover:text-primary-foreground transition-colors'
      >
        <X aria-hidden='true' className='size-4' />
      </button>
    </div>
  );
}

/** Home for an account that hosts nowhere: the tables it plays at, its record and next game at each. */
export function MemberHome() {
  const { records, error, retry, answer } = useTableRecords();
  const hostPrompt = useHostPrompt();
  return (
    <PageMain>
      <PageHeader title='Home' />
      {hostPrompt.show && <HostTableCard onDismiss={hostPrompt.dismiss} />}
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>Your tables</p>
      <DataState
        rows={records}
        error={error}
        onRetry={retry}
        empty={<p className='text-xs text-muted-foreground py-4'>{EMPTY}</p>}
      >
        {(rows) => <TableList records={rows} onAnswer={answer} />}
      </DataState>
      <LogSessionButton />
    </PageMain>
  );
}
