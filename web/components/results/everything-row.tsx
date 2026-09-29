import Link from 'next/link';

import { centsPerHour, formatDate, typeLabel, type EverythingRow as Row } from '@pb/core';
import { signedAmount, toneClass } from '@/components/results/poker-result-row';

// One row of the Everything list (log-events PLAN.md phase 3 step 3). A sibling of
// PokerResultRow rather than an edit to it: game-stakes owns that file (BD-1).

function TypeTag({ type }: { type: string }) {
  return (
    <span className='shrink-0 rounded border border-border px-1.5 py-px text-[10px] tracking-widest uppercase text-muted-foreground'>
      {typeLabel(type)}
    </span>
  );
}

// $/hr only where hours were typed: a home game records none, and most event types ask none.
function RateLine({ row }: { row: Row }) {
  const rate = centsPerHour(row.netCents, row.minutes);
  if (rate === null) return <p className='text-xs text-muted-foreground'>net</p>;
  return <p className={`text-xs tabular-nums ${toneClass(rate)}`}>{signedAmount(rate)}/hr</p>;
}

function RowBody({ row }: { row: Row }) {
  return (
    <>
      <div className='min-w-0'>
        <div className='flex items-center gap-2'>
          {/* An event logged with no place (a lottery ticket, a book left blank) reads as its type. */}
          <p className='text-sm font-medium truncate'>{row.place ?? typeLabel(row.type)}</p>
          <TypeTag type={row.type} />
        </div>
        <p className='text-xs text-muted-foreground mt-0.5'>{formatDate(row.playedOn)}</p>
        {row.detail && <p className='text-xs text-muted-foreground truncate'>{row.detail}</p>}
      </div>
      <div className='text-right shrink-0'>
        <p className={`text-sm font-semibold tabular-nums ${toneClass(row.netCents)}`}>{signedAmount(row.netCents)}</p>
        <RateLine row={row} />
      </div>
    </>
  );
}

const ROW = 'flex items-start justify-between gap-3 py-3';

// A logged poker session opens its poker edit page and an event its own; a home game has no
// href and stays inert, because its money is the host's ledger (0021 D7).
export function EverythingRow({ row }: { row: Row }) {
  if (row.href === null) return <li className={ROW}><RowBody row={row} /></li>;
  return (
    <li>
      <Link href={row.href} className={`${ROW} -mx-2 px-2 rounded-md transition-colors hover:bg-muted/50`}>
        <RowBody row={row} />
      </Link>
    </li>
  );
}
