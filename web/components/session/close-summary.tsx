import type { ReactNode } from 'react';
import { formatCents } from '@pb/core';

import type { CashoutEntry } from './close-plan';

interface CloseSummaryInput {
  entries: readonly CashoutEntry[];
  totalInCents: number;
  outCents: number;
  /** Non-zero only when the host has already told the house to keep or cover it. */
  remainingCents: number;
}

function potLine(remainingCents: number): string {
  if (remainingCents > 0) return `House keeps the $${formatCents(remainingCents)} left in the pot.`;
  if (remainingCents < 0) return `House covers the $${formatCents(-remainingCents)} paid out over the pot.`;
  return 'The pot balances.';
}

// The confirm dialog's body. A plain render function rather than a component: useConfirm
// takes the description as a node, built at the moment the host taps Close. Each player's
// amount is listed so a typo (2000 for 20) is caught here, before anything is written.
export function closeSummary({ entries, totalInCents, outCents, remainingCents }: CloseSummaryInput): ReactNode {
  return (
    <span className='block space-y-3'>
      <span className='block space-y-1'>
        {entries.map((e) => (
          <span key={e.playerId} className='flex justify-between gap-3 tabular-nums'>
            <span className='truncate'>{e.name}</span>
            <span>{e.cents === 0 ? 'Busted — $0.00' : `$${formatCents(e.cents ?? 0)}`}</span>
          </span>
        ))}
      </span>
      <span className='block border-t border-border pt-2 space-y-1 tabular-nums'>
        <span className='flex justify-between'><span>{entries.length} players · total in</span><span>${formatCents(totalInCents)}</span></span>
        <span className='flex justify-between'><span>Total out</span><span>${formatCents(outCents)}</span></span>
      </span>
      <span className='block text-foreground'>{potLine(remainingCents)}</span>
    </span>
  );
}
