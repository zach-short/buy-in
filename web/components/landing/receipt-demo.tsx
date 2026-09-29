'use client';

import { Link2 } from 'lucide-react';

import { formatCents } from '@pb/core';
import { useInView } from '@/hooks/use-in-view';
import { cn } from '@/lib/utils';
import { SESSION_NAME, finalBalances, receiptLines } from './sample-night';

const PLAYER_ID = 'maya';
const LINES = receiptLines(PLAYER_ID);
const BALANCE_CENTS = finalBalances().find((b) => b.player.id === PLAYER_ID)?.balanceCents ?? 0;

function money(cents: number): string {
  return `${cents < 0 ? '−' : ''}$${formatCents(Math.abs(cents))}`;
}

// Prints once, top to bottom, the first time it scrolls into view (`.landing-print`).
export function ReceiptDemo() {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className='mx-auto w-full max-w-sm'>
      <div className='h-2 rounded-t-md bg-muted border border-border border-b-0' aria-hidden />
      <div className={cn('landing-receipt px-6 pt-6 pb-8', inView ? 'landing-print' : 'opacity-0')}>
        <p className='font-display text-center text-sm font-semibold tracking-widest uppercase text-primary'>
          Buy-In
        </p>
        <p className='mt-1 text-center text-[10px] tracking-widest uppercase text-muted-foreground'>
          {SESSION_NAME} · Maya
        </p>
        <div className='my-5 border-t border-dashed border-border' />
        <ul className='space-y-2 text-sm'>
          {LINES.map((line, i) => (
            <li
              key={`${line.label}-${i}`}
              className='flex justify-between tabular-nums'
            >
              <span className={line.cents < 0 ? 'text-muted-foreground' : undefined}>{line.label}</span>
              <span className='text-muted-foreground'>{money(line.cents)}</span>
            </li>
          ))}
        </ul>
        <div className='my-5 border-t border-dashed border-border' />
        <div className='flex items-baseline justify-between'>
          <span className='text-[10px] tracking-widest uppercase text-muted-foreground'>Balance due</span>
          <span className='text-xl font-semibold tabular-nums text-primary'>${formatCents(BALANCE_CENTS)}</span>
        </div>
        <div className='mt-6 flex items-center justify-center gap-2 rounded-md border border-border py-2 text-[10px] tracking-widest uppercase text-muted-foreground'>
          <Link2 size={12} /> Shared by link
        </div>
      </div>
    </div>
  );
}
