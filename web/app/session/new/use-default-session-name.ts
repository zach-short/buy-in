'use client';

import { useSyncExternalStore } from 'react';

function todayLabel(): string {
  const now = new Date();
  const part = (options: Intl.DateTimeFormatOptions) => now.toLocaleDateString('en-US', options);
  return `Poker — ${part({ weekday: 'short' })} ${part({ month: 'short' })} ${part({ day: 'numeric' })}`;
}

function subscribe(): () => void {
  return () => {};
}

/**
 * "Poker — Fri Oct 3", by the browser's date. The server renders plain "Poker": its clock is
 * UTC, which on a US evening is already tomorrow, and a different date would fail hydration.
 */
export function useDefaultSessionName(): string {
  return useSyncExternalStore(subscribe, todayLabel, () => 'Poker');
}
