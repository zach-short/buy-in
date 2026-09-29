'use client';

import type { PointerEvent, ReactNode } from 'react';

import { cn } from '@/lib/utils';

// Writes the pointer position into --x/--y for `.landing-spotlight`, whose glow follows the cursor.
// A style write rather than state, so moving the mouse never re-renders the card.
function trackPointer(e: PointerEvent<HTMLDivElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--x', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--y', `${e.clientY - rect.top}px`);
}

export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      onPointerMove={trackPointer}
      className={cn('landing-spotlight landing-edge rounded-xl bg-card/70 backdrop-blur-md', className)}
    >
      {children}
    </div>
  );
}
