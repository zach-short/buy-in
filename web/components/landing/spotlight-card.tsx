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

// Opaque, with no backdrop blur: the cards sit over the landing page's drifting glows, so a blur
// was recomputed every frame. The glows are already soft, so the blur hid little, and an opaque
// fill is what `.landing-shimmer`'s multiply band needs to stay invisible off the glyphs, since
// `isolation: isolate` makes the card the band's whole backdrop. Was `bg-card/70 backdrop-blur-md`.
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      onPointerMove={trackPointer}
      className={cn('landing-spotlight landing-edge rounded-xl bg-card', className)}
    >
      {children}
    </div>
  );
}
