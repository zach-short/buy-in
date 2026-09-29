'use client';

import { useState } from 'react';

import { canMake, formatCents } from '@pb/core';
import { cn } from '@/lib/utils';
import { BOTTLES, DRINKS } from './sample-night';
import { SpotlightCard } from './spotlight-card';

// The same `canMake` the real menu runs, so what dims here is exactly what would drop off a bar.
export function MenuDemo() {
  const [dry, setDry] = useState<ReadonlySet<string>>(new Set());
  const inventory = BOTTLES.map((b) => ({ id: b.id, qtyOnHand: dry.has(b.id) ? 0 : b.qtyOnHand }));
  const pourable = DRINKS.filter((d) => canMake(d, inventory)).length;

  function toggle(id: string) {
    setDry((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <SpotlightCard className='p-5 sm:p-6'>
      <p className='text-[10px] tracking-widest uppercase text-muted-foreground mb-3'>On the shelf</p>
      <div className='flex flex-wrap gap-2 mb-6'>
        {BOTTLES.map((b) => (
          <button
            key={b.id}
            type='button'
            aria-pressed={!dry.has(b.id)}
            onClick={() => toggle(b.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-all duration-300 active:scale-95',
              dry.has(b.id)
                ? 'border-border text-muted-foreground line-through decoration-destructive/70'
                : 'border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15',
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className='flex items-baseline justify-between mb-3'>
        <p className='text-[10px] tracking-widest uppercase text-muted-foreground'>Tonight&apos;s menu</p>
        <p className='text-[10px] tracking-widest uppercase text-primary tabular-nums'>
          {pourable} of {DRINKS.length} pouring
        </p>
      </div>
      <ul className='divide-y divide-border'>
        {DRINKS.map((d) => {
          const ok = canMake(d, inventory);
          return (
            <li
              key={d.name}
              className={cn(
                'flex items-center justify-between py-2.5 text-sm transition-all duration-500',
                !ok && 'opacity-35 blur-[0.5px]',
              )}
            >
              <span className='flex items-center gap-2'>
                {d.name}
                {!ok && <span className='text-[10px] tracking-widest uppercase text-destructive'>Out</span>}
              </span>
              <span className='tabular-nums text-muted-foreground'>${formatCents(d.priceCents)}</span>
            </li>
          );
        })}
      </ul>
    </SpotlightCard>
  );
}
