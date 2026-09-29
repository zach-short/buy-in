'use client';

import type { ReactNode } from 'react';

import { useInView } from '@/hooks/use-in-view';
import { cn } from '@/lib/utils';

// Fades and lifts its children in the first time they scroll into view. The motion itself is
// `.landing-reveal` in globals.css, which also switches it off under reduced motion.
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      data-in={inView || undefined}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn('landing-reveal', className)}
    >
      {children}
    </div>
  );
}
