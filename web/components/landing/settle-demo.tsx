'use client';

import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';

import { formatCents, venmoNote } from '@pb/core';
import { cn } from '@/lib/utils';
import { SESSION_NAME, finalBalances } from './sample-night';
import { SpotlightCard } from './spotlight-card';

const BALANCES = finalBalances();

function owesLine(name: string, balanceCents: number): string {
  return balanceCents > 0 ? `${name} owes the house` : `The house owes ${name}`;
}

// Tapping a row stands in for the Venmo handoff: the real button opens Venmo with this amount and
// this note, and nothing here navigates anywhere.
export function SettleDemo() {
  const [paid, setPaid] = useState<ReadonlySet<string>>(new Set());
  const allSquare = paid.size === BALANCES.length;

  return (
    <SpotlightCard className='p-5 sm:p-6'>
      <div className='flex items-baseline justify-between mb-4'>
        <p className='text-[10px] tracking-widest uppercase text-muted-foreground'>Settle up · {SESSION_NAME}</p>
        <p className='text-[10px] tracking-widest uppercase text-primary tabular-nums'>
          {paid.size} of {BALANCES.length} square
        </p>
      </div>

      <ul className='space-y-2'>
        {BALANCES.map(({ player, balanceCents }) => {
          const done = paid.has(player.id);
          return (
            <li key={player.id}>
              <button
                type='button'
                disabled={done}
                onClick={() => setPaid((prev) => new Set(prev).add(player.id))}
                className={cn(
                  'group flex w-full items-center justify-between gap-3 rounded-md border px-3 py-3 text-left transition-all duration-500',
                  done ? 'border-primary/30 bg-primary/5' : 'border-border bg-background/60 hover:border-primary/50',
                )}
              >
                <span className='min-w-0'>
                  <span className='block text-sm font-medium'>{player.name}</span>
                  <span className='block text-xs text-muted-foreground truncate'>{owesLine(player.name, balanceCents)}</span>
                </span>
                <span className='flex shrink-0 items-center gap-3'>
                  <span className={cn('text-sm tabular-nums transition-all duration-500', done ? 'text-muted-foreground line-through' : 'text-primary')}>
                    ${formatCents(Math.abs(balanceCents))}
                  </span>
                  {done ? (
                    <span className='landing-stamp flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground'>
                      <Check size={14} strokeWidth={3} />
                    </span>
                  ) : (
                    <span className='rounded-md border border-primary/40 px-2.5 py-1 text-[10px] tracking-widest uppercase text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground'>
                      Venmo
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className='mt-4 flex items-center justify-between text-xs text-muted-foreground'>
        {allSquare ? (
          <span className='landing-shimmer font-medium'>Everyone&apos;s square.</span>
        ) : (
          <span>
            Note: <span className='text-foreground'>{venmoNote(SESSION_NAME)}</span>
          </span>
        )}
        {paid.size > 0 && (
          <button
            type='button'
            onClick={() => setPaid(new Set())}
            className='flex items-center gap-1.5 tracking-widest uppercase text-[10px] hover:text-foreground transition-colors'
          >
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>
    </SpotlightCard>
  );
}
