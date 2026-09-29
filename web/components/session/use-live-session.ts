'use client';

import useSWR from 'swr';

import { useSessionRealtime } from '@/hooks/use-session-realtime';
import {
  fetchDrinks, fetchInventory, fetchPlayers, fetchSession, fetchSessionBuyIns, fetchSessionCashouts, fetchSessionOrders,
} from '@/lib/supabase/queries';

// Every read the live session screen makes, with the same SWR keys as before so the realtime
// hook (web/hooks/use-session-realtime.ts) refetches the right entries.
//
// Phase 11: while the channel is SUBSCRIBED the session-scoped keys do not poll; while it is
// not, they fall back to the 15 s poll — all four (the hook polls ['session', id]), since a
// rebuy, a cash-out or a close is as live as a pour.
export function useLiveSession(id: string) {
  const { refreshInterval, subscribed } = useSessionRealtime(id);
  const session = useSWR(['session', id], ([, sessionId]) => fetchSession(sessionId));
  const players = useSWR('players', fetchPlayers);
  const orders = useSWR(['orders', id], ([, sessionId]) => fetchSessionOrders(sessionId), { refreshInterval });
  const buyIns = useSWR(['buy_ins', id], ([, sessionId]) => fetchSessionBuyIns(sessionId), { refreshInterval });
  const cashouts = useSWR(['cashouts', id], ([, sessionId]) => fetchSessionCashouts(sessionId), { refreshInterval });
  const drinks = useSWR('drinks', fetchDrinks);
  const inventory = useSWR('inventory', fetchInventory);

  // A first load that failed has no data to fall back on; the app's SWRConfig does not retry
  // on error, so without this the screen would say "Loading…" forever. A failure on a later
  // revalidation keeps the last good rows and is covered by the reconnecting banner instead.
  const required = [session, players, orders, buyIns, cashouts] as const;
  const loadError = required.find((r) => r.data === undefined && r.error)?.error as Error | undefined;

  function retryLoad() {
    for (const r of required) if (r.data === undefined) void r.mutate();
  }

  return {
    subscribed,
    loadError,
    retryLoad,
    session: session.data,
    sessionLoading: session.data === undefined,
    players: players.data,
    orders: orders.data ?? [],
    buyIns: buyIns.data ?? [],
    cashouts: cashouts.data ?? [],
    ledgerLoaded: orders.data !== undefined && buyIns.data !== undefined && cashouts.data !== undefined,
    drinks: drinks.data ?? [],
    inventory: inventory.data ?? [],
    mutateSession: session.mutate,
    mutatePlayers: players.mutate,
    mutateOrders: orders.mutate,
    mutateBuyIns: buyIns.mutate,
    mutateCashouts: cashouts.mutate,
    mutateInventory: inventory.mutate,
  };
}

export type LiveSession = ReturnType<typeof useLiveSession>;
