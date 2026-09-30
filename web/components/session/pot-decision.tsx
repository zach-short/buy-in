'use client';

import { useState } from 'react';
import { formatCents } from '@pb/core';

import type { CashoutEntry } from './close-plan';
import { cn } from '@/lib/utils';

interface PotDecisionProps {
  entries: readonly CashoutEntry[];
  remainingCents: number;
  houseAckCents: number | null;
  onAssign: (playerId: string) => void;
  onHouse: (cents: number | null) => void;
}

// Shown only once every player is entered and the pot still does not balance. Closing is
// blocked until the host picks one: put the difference on a player's cash-out, or say the
// house keeps (or covers) it — which writes nothing, it only records that the host saw it.
export function PotDecision({ entries, remainingCents, houseAckCents, onAssign, onHouse }: PotDecisionProps) {
  const [assignee, setAssignee] = useState(entries[0]?.playerId ?? '');
  const amount = `$${formatCents(Math.abs(remainingCents))}`;
  const over = remainingCents < 0;
  const houseChosen = houseAckCents === remainingCents;

  return (
    <div className='border border-primary/50 rounded-md px-4 py-4 mb-6 space-y-3'>
      <p className='text-sm'>
        {over ? `${amount} more cashed out than bought in.` : `${amount} still in the pot.`} What happens to it?
      </p>
      <div className='flex gap-2'>
        <select
          aria-label='Player'
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className='h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-base md:text-sm'
        >
          {entries.map((e) => <option key={e.playerId} value={e.playerId}>{e.name}</option>)}
        </select>
        <button
          type='button'
          disabled={!assignee}
          onClick={() => onAssign(assignee)}
          className='h-11 shrink-0 rounded-md border border-border px-3 text-xs tracking-widest uppercase hover:border-primary hover:text-primary transition-colors disabled:opacity-40'
        >
          {over ? `Take ${amount} off` : `Give ${amount}`}
        </button>
      </div>
      <button
        type='button'
        aria-pressed={houseChosen}
        onClick={() => onHouse(houseChosen ? null : remainingCents)}
        className={cn(
          'w-full h-11 rounded-md border text-xs tracking-widest uppercase transition-colors',
          houseChosen ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground',
        )}
      >
        {houseChosen ? '✓ ' : ''}{over ? 'House covers it' : 'House keeps it'}
      </button>
    </div>
  );
}
