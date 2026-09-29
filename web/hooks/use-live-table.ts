'use client';

import { useEffect, useState } from 'react';

import { TABLE_EVENTS, type TableEvent } from '@/components/landing/sample-night';

const STEP_MS = 2200;
// The full table holds for two beats before the night starts over, so the last event is readable.
const HOLD_STEPS = 2;

/**
 * Plays the sample night forward one event at a time while `running`. Reduced motion shows the
 * finished table and never ticks, so nothing on the page moves on its own.
 */
export function useLiveTable({ running, reduced }: { running: boolean; reduced: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!running || reduced) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % (TABLE_EVENTS.length + HOLD_STEPS + 1)), STEP_MS);
    return () => window.clearInterval(id);
  }, [running, reduced]);

  const played = reduced ? TABLE_EVENTS.length : Math.min(step, TABLE_EVENTS.length);
  const latest: TableEvent | null = played > 0 ? TABLE_EVENTS[played - 1] : null;
  return { played, latest };
}
