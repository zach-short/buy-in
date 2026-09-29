'use client';

import { useState } from 'react';
import Link from 'next/link';

import { formatCents, isSettled, type RsvpAnswer, type TableRecord, type TableWithGame } from '@pb/core';
import { NextGameRow } from '@/components/member/next-game';
import { DataState } from '@/components/shared/data-state';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { useTableRecords } from '@/hooks/use-table-records';
import { MEMBER_HOME_TABLE_LIMIT } from '@/lib/config';

// Copy chosen by the owner 2026-09-29, plain register (member-home SCOPE.md §7, build-time answers).
const EMPTY = "You're not at any tables yet. Ask a host for an invite link.";

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

/** Home for an account that hosts nowhere: the tables it plays at, its record and next game at each. */
export function MemberHome() {
  const { records, error, retry, answer } = useTableRecords();
  return (
    <PageMain>
      <PageHeader title='Buy-In' />
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>Your tables</p>
      <DataState
        rows={records}
        error={error}
        onRetry={retry}
        empty={<p className='text-xs text-muted-foreground py-4'>{EMPTY}</p>}
      >
        {(rows) => <TableList records={rows} onAnswer={answer} />}
      </DataState>
    </PageMain>
  );
}
