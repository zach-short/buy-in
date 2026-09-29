'use client';

import useSWR from 'swr';

import { mergeEverything, rowsFromEvents, rowsFromPoker, type EverythingRow } from '@pb/core';
import { resultDetail } from '@/components/results/poker-result-row';
import { usePokerResults } from '@/hooks/use-poker-results';
import { fetchMyLoggedEvents } from '@/lib/supabase/logged-events';

export interface EverythingResultsState {
  rows: EverythingRow[] | undefined;
  error: Error | undefined;
  retry: () => void;
}

/**
 * The signed-in player's whole P&L across every kind of result (log-events SCOPE K2(a)): poker's
 * home games and logged sessions, through usePokerResults and its keys unchanged (SCOPE H9), plus
 * the events under their own key, 'logged_events', which phase 2's form revalidates after a save.
 * A poker row reads exactly as it does on My poker, because its detail line is poker's own
 * `resultDetail` (PLAN.md BD-1).
 */
export function useEverythingResults(): EverythingResultsState {
  const poker = usePokerResults();
  const events = useSWR('logged_events', fetchMyLoggedEvents);
  const rows = poker.results && events.data
    ? mergeEverything(rowsFromPoker(poker.results, resultDetail), rowsFromEvents(events.data))
    : undefined;
  return {
    rows,
    error: poker.error ?? events.error,
    retry: () => {
      poker.retry();
      void events.mutate();
    },
  };
}
