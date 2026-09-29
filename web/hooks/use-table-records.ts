'use client';

import useSWR from 'swr';
import { toast } from 'sonner';

import { tableRecords, withNextGames, type NextGameLike, type RsvpAnswer, type TableWithGame } from '@pb/core';
import { fetchMyUpcomingGames, rsvpMyGame } from '@/lib/supabase/member-games';
import { fetchMyPerformance } from '@/lib/supabase/performance';
import { fetchMyTables } from '@/lib/supabase/tables';

const GAMES_KEY = 'get_my_upcoming_games';

export interface TableRecordsState {
  records: TableWithGame[] | undefined;
  error: Error | undefined;
  retry: () => void;
  /** Answers a table's next game from its card; the card shows the new answer at once. */
  answer: (gameId: string, status: RsvpAnswer) => Promise<void>;
}

function withAnswer(games: NextGameLike[] | undefined, gameId: string, status: RsvpAnswer): NextGameLike[] | undefined {
  return games?.map((game) => (game.game_id === gameId ? { ...game, my_status: status } : game));
}

/**
 * The tables the signed-in account sits at, each with its record there and its next game. The
 * first two keys are the ones Account ('my_tables') and Results ('get_my_performance') already
 * read, so leaving a table or a new cashout reaches Home without a refetch of its own.
 */
export function useTableRecords(): TableRecordsState {
  const tables = useSWR('my_tables', fetchMyTables);
  const played = useSWR('get_my_performance', fetchMyPerformance);
  const games = useSWR(GAMES_KEY, fetchMyUpcomingGames);
  const records = tables.data && played.data && games.data
    ? withNextGames(tableRecords(tables.data, played.data), games.data)
    : undefined;

  // Optimistic, as Leave is on Account (use-my-tables.ts). The re-read afterwards confirms a
  // saved answer, or puts back the server's own after a refusal.
  async function answer(gameId: string, status: RsvpAnswer) {
    void games.mutate(withAnswer(games.data, gameId, status), { revalidate: false });
    const failed = await rsvpMyGame(gameId, status);
    if (failed) toast.error(failed.message);
    await games.mutate();
  }

  return {
    records,
    error: tables.error ?? played.error ?? games.error,
    retry: () => {
      void tables.mutate();
      void played.mutate();
      void games.mutate();
    },
    answer,
  };
}
