'use client';

import useSWR from 'swr';

import { mergeResults, resultsFromLogged, resultsFromPerformance, type PokerResult } from '@pb/core';
import { fetchMyLoggedSessions } from '@/lib/supabase/logged-sessions';
import { fetchMyPerformance } from '@/lib/supabase/performance';

export interface PokerResultsState {
  results: PokerResult[] | undefined;
  error: Error | undefined;
  retry: () => void;
}

/**
 * The signed-in player's whole P&L: their home games and the games they logged, merged
 * (logged-sessions DESIGN.md D2). 'get_my_performance' is the key member Home also reads
 * (use-table-records.ts), so the two share one cache; 'logged_sessions' is what item 24's
 * form revalidates after a save.
 */
export function usePokerResults(): PokerResultsState {
  const home = useSWR('get_my_performance', fetchMyPerformance);
  const logged = useSWR('logged_sessions', fetchMyLoggedSessions);
  const results = home.data && logged.data
    ? mergeResults(resultsFromPerformance(home.data), resultsFromLogged(logged.data))
    : undefined;
  return {
    results,
    error: home.error ?? logged.error,
    retry: () => {
      void home.mutate();
      void logged.mutate();
    },
  };
}
