'use client';

import { formatCents } from '@pb/core';

import { useInView } from '@/hooks/use-in-view';
import { useLiveTable } from '@/hooks/use-live-table';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';
import { SESSION_NAME, playerName, tableRows, type TableEvent } from './sample-night';
import { SpotlightCard } from './spotlight-card';

function describe(event: TableEvent): string {
  const who = playerName(event.playerId);
  return event.kind === 'rebuy'
    ? `${who} rebought · $${formatCents(event.amountCents)}`
    : `${who} ordered a ${event.drink} · $${formatCents(event.priceCents)}`;
}

export function LiveTableDemo() {
  const [ref, inView] = useInView<HTMLDivElement>({ once: false });
  const reduced = usePrefersReducedMotion();
  const { played, latest } = useLiveTable({ running: inView, reduced });
  const rows = tableRows(played);

  return (
    <div ref={ref} className='relative'>
      <div aria-hidden className='landing-halo' />
      <SpotlightCard className='relative p-5 sm:p-6'>
        <div className='flex items-center justify-between mb-5'>
          <div>
            <p className='text-[10px] tracking-widest uppercase text-muted-foreground'>Session</p>
            <p className='text-sm font-medium'>{SESSION_NAME}</p>
          </div>
          <span className='flex items-center gap-2 text-[10px] tracking-widest uppercase text-primary'>
            <span className='relative flex size-2'>
              <span className='absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping' />
              <span className='relative inline-flex size-2 rounded-full bg-primary' />
            </span>
            Table live
          </span>
        </div>

        <div className='grid grid-cols-[minmax(0,1fr)_repeat(3,3.75rem)] sm:grid-cols-[minmax(0,1fr)_repeat(3,4.5rem)] gap-x-2 px-3 pb-2 text-[10px] tracking-widest uppercase text-muted-foreground'>
          <span>Player</span>
          <span className='text-right'>Chips</span>
          <span className='text-right'>Bar</span>
          <span className='text-right'>Tab</span>
        </div>
        <ul className='space-y-1.5'>
          {rows.map((row) => (
            <li
              key={row.player.id}
              className='relative grid grid-cols-[minmax(0,1fr)_repeat(3,3.75rem)] sm:grid-cols-[minmax(0,1fr)_repeat(3,4.5rem)] gap-x-2 overflow-hidden rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm tabular-nums'
            >
              {latest?.playerId === row.player.id && <span key={played} aria-hidden className='landing-flash' />}
              <span className='relative font-medium'>{row.player.name}</span>
              <span className='relative text-right text-muted-foreground'>${formatCents(row.inCents)}</span>
              <span className='relative text-right text-muted-foreground'>${formatCents(row.barCents)}</span>
              <span className='relative text-right text-primary'>${formatCents(row.tabCents)}</span>
            </li>
          ))}
        </ul>

        <div className='mt-4 h-5 overflow-hidden text-xs text-muted-foreground'>
          <p key={played} className={cn(latest && 'landing-ticker-in')}>
            {latest ? describe(latest) : 'Four players bought in · $40.00 each'}
          </p>
        </div>
      </SpotlightCard>
    </div>
  );
}
