import Link from 'next/link';

import { centsPerHour, formatBlinds, formatCents, formatDate, isSettled, type PokerResult } from '@pb/core';

// players/[id]/page.tsx's colours for whose money it is: green when it is the player's,
// destructive when it is gone, muted at even. A PokerResult's netCents is already signed the
// player's way (positive = won), so positive is green here — the reverse of a ledger balance,
// where positive means the player owes the house.
export function toneClass(cents: number): string {
  if (isSettled(cents)) return 'text-muted-foreground';
  return cents > 0 ? 'text-green-500' : 'text-destructive';
}

export function signedAmount(cents: number): string {
  if (isSettled(cents)) return 'Even';
  return cents > 0 ? `+$${formatCents(cents)}` : `-$${formatCents(Math.abs(cents))}`;
}

/**
 * The line under the place. A home game keeps its label exactly as before: `stakesCents` is the
 * bar's current default buy-in, not the night's stakes (0004), and fixing that is game-stakes',
 * not this item's (logged-sessions DESIGN.md "Rules that survive unchanged"). A logged game
 * shows its real blinds.
 */
export function resultDetail(row: PokerResult): string {
  if (row.source === 'home') return `$${formatCents(row.stakesCents)} game · ${row.sessionName}`;
  const blinds = formatBlinds(row.smallBlindCents, row.bigBlindCents, row.straddleCents);
  return row.gameFormat ? `${blinds} · ${row.gameFormat}` : blinds;
}

function LoggedTag() {
  return (
    <span className='shrink-0 rounded border border-border px-1.5 py-px text-[10px] tracking-widest uppercase text-muted-foreground'>
      Logged
    </span>
  );
}

// $/hr is on a logged row only: a home game records no hours (DESIGN.md D4).
function RateLine({ row }: { row: PokerResult }) {
  const rate = row.source === 'logged' ? centsPerHour(row.netCents, row.minutes) : null;
  if (rate === null) return <p className='text-xs text-muted-foreground'>net</p>;
  return <p className={`text-xs tabular-nums ${toneClass(rate)}`}>{signedAmount(rate)}/hr</p>;
}

function RowBody({ row }: { row: PokerResult }) {
  return (
    <>
      <div className='min-w-0'>
        <div className='flex items-center gap-2'>
          <p className='text-sm font-medium truncate'>{row.place}</p>
          {row.source === 'logged' && <LoggedTag />}
        </div>
        <p className='text-xs text-muted-foreground mt-0.5'>{formatDate(row.playedOn)}</p>
        <p className='text-xs text-muted-foreground truncate'>{resultDetail(row)}</p>
      </div>
      <div className='text-right shrink-0'>
        <p className={`text-sm font-semibold tabular-nums ${toneClass(row.netCents)}`}>{signedAmount(row.netCents)}</p>
        <RateLine row={row} />
      </div>
    </>
  );
}

const ROW = 'flex items-start justify-between gap-3 py-3';

// A logged row opens for edit or delete (DESIGN.md D5). A home row stays inert: its money is the
// host's ledger, corrected at the table, never from here (D7).
export function PokerResultRow({ row }: { row: PokerResult }) {
  if (row.source === 'home') return <li className={ROW}><RowBody row={row} /></li>;
  return (
    <li>
      <Link href={`/results/log/${row.id}`} className={`${ROW} -mx-2 px-2 rounded-md transition-colors hover:bg-muted/50`}>
        <RowBody row={row} />
      </Link>
    </li>
  );
}
